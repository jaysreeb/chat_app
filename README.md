# chat://

A real-time chat application built with Node.js, TypeScript, PostgreSQL, and raw WebSockets.
---

## What it does

- Register and login with email and password
- Real-time one-to-one messaging over WebSockets
- Messages persist to PostgreSQL, offline users receive them on reconnect
- JWT authentication on both HTTP routes and the WebSocket handshake
- Rate limiting per user (in progress)
- Fully containerised with Docker

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js | Non-blocking I/O, ideal for concurrent connections |
| Language | TypeScript | Type safety, catches bugs at compile time |
| Framework | Express | Minimal, does not hide what is happening |
| WebSockets | `ws` library (raw) | To get an understanding of the protocol |
| Database | PostgreSQL | Relational data, ACID guarantees, strong at indexing |
| Auth | JWT | Stateless - no DB hit on every request |
| Passwords | bcrypt | Intentionally slow hashing, resistant to brute force |
| Containers | Docker + Docker Compose | Same environment locally and in production |

---

## Architecture

### High-level overview

```
Client (Browser)
    │
    ├── HTTP (REST)  ──►  Express routes  ──►  PostgreSQL
    │                          │
    └── WebSocket   ──►  ws server
                           │
                    Connection Map (memory)
                    userId → socket
```

The server runs two protocols on the same HTTP server instance:

- **HTTP** handles auth (register, login) and data fetching (message history)
- **WebSocket** handles real-time delivery

They share the same PostgreSQL connection pool. The WebSocket server does not replace HTTP, it extends it for the parts that need to be live.

---

### The connection registry

The most important data structure in the app is a JavaScript `Map`:

```typescript
const clients = new Map<number, ConnectedClient>();
// userId → { socket, email }
```

This is the answer to "who is online right now?" Every incoming WebSocket connection is registered here. Every disconnect removes the entry. When a message arrives, the server checks this Map to decide whether to deliver immediately or queue in PostgreSQL.

This is an in-memory structure, it lives inside the Node.js process. It is fast. It is also the architectural boundary: it will break if scaled beyond single server. The solution at scale is Redis pub/sub, where all server instances subscribe to a shared channel. That is documented in the Scaling section below.

---

### Auth flow

```
POST /register
    │
    ├── Validate input (email format, password length)
    ├── bcrypt.hash(password, 10)          ← intentionally slow
    ├── INSERT INTO users ...              ← UNIQUE constraint on email
    └── 201 + { id, email, created_at }   ← never return password

POST /login
    │
    ├── SELECT * FROM users WHERE email = $1
    ├── bcrypt.compare(incoming, stored_hash)
    ├── jwt.sign({ userId, email }, secret, { expiresIn: '24h' })
    └── 200 + { token, user }
```

**Why "invalid credentials" for both wrong email and wrong password?**  
Returning "user not found" vs "wrong password" tells an attacker which emails are valid. Always return the same error for both cases.

**Why bcrypt with saltRounds = 10?**  
MD5 and SHA256 are designed to be fast. Fast is bad for passwords, an attacker with a stolen database can try billions of combinations per second. bcrypt does 1024 iterations (2^10). A brute-force attack that would take hours against SHA256 takes years against bcrypt.

**Why JWT instead of sessions?**  
Sessions store state on the server, every request hits the database to validate the session. JWT is stateless, the token carries the user's identity, signed with a secret. The server just verifies the signature. No database hit. The tradeoff: you cannot invalidate a JWT before it expires, which is why `expiresIn: '24h'` matters.

---

### WebSocket flow

```
Client connects: ws://server?token=eyJhbG...
    │
    ├── Server extracts token from query string
    ├── jwt.verify(token, secret)          ← reject immediately if invalid
    ├── clients.set(userId, { socket })    ← register in Map
    ├── Fetch undelivered messages from DB ← flush offline queue
    │
    └── Listen for messages
            │
            ├── Parse JSON: { type, to, content }
            ├── saveMessage(senderId, to, content)   ← always persist first
            │
            ├── Is recipient in Map?
            │       YES → socket.send(message)
            │             markDelivered(messageId)
            │
            │       NO  → message stays in DB with delivered = false
            │             notify sender: "queued"
            │
            └── On close: clients.delete(userId)
```

**Why the token is in the query string, not a header?**  
The browser's native `WebSocket` API does not allow custom headers like `Authorization` during the WebSocket handshake. Because of this limitation, a common approach is to pass the JWT token as a query parameter during connection establishment.
Example: ws://localhost:3000?token=JWT_TOKEN

In production systems, this is usually combined with:
- `wss://` (encrypted WebSocket connections)
- short-lived tokens
- session validation or token rotation

since query parameters may appear in logs or monitoring systems.


**Why save to DB before delivering?**  
If the server crashes between delivery and persistence, the message is lost. Saving first guarantees the message exists. This is the same principle as write-ahead logging (WAL) in databases, durability before acknowledgement.

---

### Database schema

```sql
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,          -- bcrypt hash, not plain text
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  sender_id   INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  content     TEXT NOT NULL,
  delivered   BOOLEAN DEFAULT FALSE,  -- the offline queue flag
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Why `delivered BOOLEAN`?**  
This is the offline queue mechanism. When a message arrives for an offline user, it is saved with `delivered = false`. When that user connects, the server runs:

```sql
SELECT * FROM messages
WHERE receiver_id = $1 AND delivered = false
ORDER BY created_at ASC;
```

Then marks them all delivered. Its simple and reliable, no separate queue table needed.

**Why `TIMESTAMPTZ` instead of `TIMESTAMP`?**  
`TIMESTAMPTZ` stores in UTC and converts to the client's timezone. `TIMESTAMP` stores whatever you give it with no timezone awareness. A chat app with users in multiple timezones needs `TIMESTAMPTZ`.

---

### Docker setup

The app runs as two containers orchestrated by Docker Compose:

```
docker-compose.yml
    │
    ├── app container      (Node.js — built from Dockerfile)
    │       └── depends_on postgres (waits for healthcheck)
    │
    └── postgres container (postgres:16-alpine)
            ├── init.sql runs on first start → creates tables
            └── postgres_data volume → persists across restarts
```

**Why `depends_on` with `service_healthy`?**  
Without the healthcheck condition, Docker starts the Node.js container the moment the Postgres container starts, but Postgres takes a few seconds to be ready to accept connections. The app would crash trying to connect before Postgres is up. The healthcheck (`pg_isready`) makes Docker wait until Postgres is actually accepting connections.

**Why a named volume for postgres_data?**  
Without the volume, every `docker compose down` wipes the database. The named volume persists the data between restarts. `docker compose down -v` removes it — useful when you want a clean slate during development.


---

## Scaling considerations

This app works perfectly for a single server. These are the limits and the solutions:

**Problem 1: The connection Map breaks at scale**  
If you run two Node.js instances behind a load balancer, User A connects to Server 1, User B connects to Server 2. A message from A to B fails because Server 1's Map does not contain B.

**Solution:** Redis pub/sub. Both servers subscribe to a shared Redis channel. Server 1 publishes the message, Server 2 receives it and delivers to B. This is how WhatsApp, Slack, and Discord scale their WebSocket layers.

**Problem 2: JWT cannot be revoked before expiry**  
If a user's account is compromised, their token is valid for up to 24 hours.

**Solution:** Refresh token pattern. Short-lived access token (15 minutes) + long-lived refresh token stored in an httpOnly cookie. On access token expiry, the client silently fetches a new one using the refresh token.

**Problem 3: No index on messages table**  
As messages grow, `SELECT ... WHERE receiver_id = $1 AND delivered = false` becomes a full table scan.

**Solution:**
```sql
CREATE INDEX idx_messages_receiver_delivered
ON messages(receiver_id, delivered)
WHERE delivered = false;
```
A partial index on only undelivered messages, its small, fast, directly serves the offline queue query.

---

## Running locally

```bash
git clone https://github.com/jaysreeb/chat_app_backend.git
cd chat_app_backend
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000` — register two accounts in two tabs and start chatting.

---

## Project structure

```
chat-app/
  src/
    index.ts              — Express server + WebSocket init
    db.ts                 — PostgreSQL connection pool
    routes/
      auth.ts             — /register and /login endpoints
    middleware/
      auth.ts             — JWT verification middleware
    websocket/
      server.ts           — WebSocket server + connection registry
      messageService.ts   — DB queries for messages
  init.sql                — Database schema (runs on first container start)
  Dockerfile
  docker-compose.yml
```

---

## Resources

These are the primary sources used to build this project:

- **WebSockets (protocol)**  https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
- **ws library** https://github.com/websockets/ws
- **PostgreSQL** https://www.postgresql.org/docs/current/index.html
- **JWT** https://jwt.io/introduction
- **node-postgres (pg)** https://node-postgres.com
- **Docker Compose** https://docs.docker.com/compose/

---

## What I learned building this

Working without Socket.io forced me to understand the WebSocket upgrade handshake, how browsers negotiate protocol switches over HTTP, and why persistent connections are fundamentally different from request-response. The connection registry problem , how does a server know which socket belongs to which user, turned out to be the core design challenge, and solving it in memory first made the scaling limitation obvious: the Map is the bottleneck, Redis is the answer.

Writing every SQL query by hand rather than using an ORM made the `delivered = false` index opportunity visible. With an ORM you describe what you want; with raw SQL you see what the database is actually doing.

---
## Frontend
  

## Next 
    1. Rate limiter        

## Features to Add
    2. Heartbeat           
    3. Message status     
    4. Structured logging 
    5. Pagination         
    6. Unit tests          
    7. Image support       
    8. Message sequencing  
