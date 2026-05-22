import express, {Response} from 'express';
import authRoutes from './routes/auth';
import usersRouter from './routes/users';
import { AuthRequest, authenticateToken} from './middleware/auth';
import { createServer } from 'node:http';
import {initWebSocketServer} from './websocket/server';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ].filter(Boolean);

    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, usersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/me', authenticateToken, (req: AuthRequest, res:Response) => {
  res.json({
    message: 'You are authenticated',
    userId: req.userId,
    email: req.email,
    username: req.username,
  });
});


// web socket server created
const server = createServer(app);
initWebSocketServer(server);

server.listen(PORT,'0.0.0.0',() => {
  console.log(`Server running on port ${PORT}`);
});