// This module will own user discovery,usernames-
// authenticated users can access it, and it will return 
// a list of users with their id,username

import { Router, Request, Response } from 'express';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async(req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT id, username FROM users  WHERE id != $1 ORDER BY username`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
})
export default router;