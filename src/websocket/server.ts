import {WebSocketServer, WebSocket} from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

// Connected Client
interface ConnectedClient {
    userId: number;
    email: string;
    socket: WebSocket;
}

// Shape of message we receive
interface IncomingMessages {
    type: 'message';
    to: number;
    content: string;
}
// The connection registry — userId → client
const clients = new Map<number, ConnectedClient>();

export function initWebSocketServer(server:Server){
    const wss = new WebSocketServer({server});

    wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    // 1. Extract token from query string
    // Client connects as: ws://localhost:3000?token=eyJhbG...
        const url = new URL(req.url!, 'http://${req.header.host}');

        const token = url.searchParams.get('token');

        if(!token){
            socket.close(1000, 'No token provided');
            return;
        }
        //2. Verify the Token
        let decoded: {userId: number; email: string};
        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET as string
            ) as {userId: number; email: string};            
        } catch (err) {
            socket.close(1000, 'Invaid token');
            return;            
        }
        // 3. Register the Connection
        // 4. Tell the user they're connected
        // 5. Handle Incoming messages
        // 6. Handle disconnect
        // 7. If recipient is online, deliver immediately
        // Confirm delivery to sender
        // 8. Recipient offline — tell sender
        // Next step: persist to PostgreSQL


    })
}

