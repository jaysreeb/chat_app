import express, {Response} from 'express';
import authRoutes from './routes/auth';
import { AuthRequest, authenticateToken} from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/me', authenticateToken, (req: AuthRequest, res:Response) => {
  res.json({
    message: 'You are authenticated',
    userId: req.userId,
    email: req.email,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});