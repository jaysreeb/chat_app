# Chat App

A real-time chat application built with Node.js, TypeScript, PostgreSQL and WebSockets.

## Tech Stack
- Node.js + Express + TypeScript
- PostgreSQL
- JWT Authentication
- WebSockets (ws library)
- Docker + Docker Compose

## Running locally
- git clone git@github.com:jaysreeb/chat_app.git
- cd chat_app
- docker compose up --build

## Creating the websocket Server in websocket/server.ts
 - 1. Extract token from query string
 - 2. Verify the Token
 - 3. Register the Connection
 - 4. Tell the user they're connected
 - 5. Handle Incoming messages
 - 6. Handle disconnect
 - 7. If recipient is online, deliver immediately
 - 8. Confirm delivery to sender
 - 9. Recipient offline (tell sender)
 - 10. Next step: persist to PostgreSQL
