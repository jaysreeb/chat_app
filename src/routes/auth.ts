import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db';
import jwt from 'jsonwebtoken';


const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be 8+ characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, hashedPassword]
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });

  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// login
router.post('/login', async (req: Request, res: Response) =>{
  const {email, password} = req.body;

  // Validation
  if(!email || !password){
    return res.status(400).json({error: 'Email and Password are required'});
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    const user = result.rows[0];
    if(!user){
      return res.status(401).json({error: 'Invalid Credentials'});
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if(!passwordMatch){
      return res.status(401).json({error: 'Invalid Credentials'});
    }
    // Sign a JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email},
      process.env.JWT_SECRET as string,
      {expiresIn: '24h'}
    );
    // Return token
    return res.status(200).json({
      message: 'Login Successful',
      token,
      user:{
        id: user.id,
        email: user.email,
      }
    });   
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error'});    
  }
});

export default router;