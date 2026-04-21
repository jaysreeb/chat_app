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
 - 10. persist to PostgreSQL (Not added yet)

## Features to add 
 - 1. server pings the client every 20 or 30 seconds - Heartbeat/Ping-Pong
 - 2. Emit events for sent, delivered (received by client), and read (client opened the chat) like watsapp
 - 3. Message Sequencing
 - 4. Pagination - May be
 - 5. Rate Limiting
 - 6. Image Support
 - 7. Structured logging, Unit Testing 
