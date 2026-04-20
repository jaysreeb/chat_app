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
// Shape of the message
interface IncomingMessage2 {
    type: 'message';
    to: number;
    content: string;
}
// The connection registry
const clients = new Map<number, ConnectedClient>();

export function initWebSocketServer(server:Server){
    const wss = new WebSocketServer({server});

    wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    // 1. Extract token from query string
    // Client connects as: ws://localhost:3000?token=eyJhbG...
        console.log("CONNECTED");
        const url = new URL(req.url!, 'http://${req.headers.host}');
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

        const {userId, email} = decoded;

        // 3. Register the Connection
        clients.set(userId, {userId, email, socket});
        console.log(`User ${email} connected. Online: ${clients.size}`);

        // 4.Tell the user they're connected
        socket.send(JSON.stringify({
            type: 'connected',
            message: 'Connected Successfully',
        }))
        // 5.Handle Incoming messages
        socket.on('message', (data) =>{
        try{
            const parsed: IncomingMessage2 = JSON.parse(data.toString());
            
            if(parsed.type === 'message'){
                handleMessage(userId, parsed);
            }
        }catch(err){
            socket.send(JSON.stringify({type:'error', message:'Invalid message format'}))
        }
        });
        // 6.Handle disconnect
        socket.on('close', () => {
            clients.delete(userId);
            console.log(`User ${email} disconnected. Online: ${clients.size}`);
        });
         console.log('WebSocket server initialized');
    });
}

function handleMessage(senderId: number, msg: IncomingMessage2){
    const sender = clients.get(senderId);
    const recipient = clients.get(msg.to);

    if(!sender) return;

    // 7. If recipient is online, deliver immediately
    if(recipient && recipient.socket.readyState === WebSocket.OPEN){
        recipient.socket.send(JSON.stringify({
            type: 'message',
            from: senderId,
            content: msg.content,
            timestamp: new Date().toISOString(),
        }));
        // Confirm delivery to sender
        sender.socket.send(JSON.stringify({
        type: 'delivered',
        to: msg.to,
        content: msg.content,
    }));
    }else{
        // 8. Recipient offline — tell sender
        sender.socket.send(JSON.stringify({
            type: 'queued',
            message: 'USer is offline. Message will be delivered once online',
        }))        
    } 
    // Next step: persist to PostgreSQL
}

