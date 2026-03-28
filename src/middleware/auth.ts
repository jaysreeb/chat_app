import {Request, Response, NextFunction} from 'express';
import jwt from 'jsonwebtoken';

//Middleware to protect routes

export interface AuthRequest extends Request{
	userId?: number;
	email?: string;
}

export const authenticateToken = (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	const authHeader = req.headers ['authorization'];
	const token = authHeader && authHeader.split('')[1];
  	if(!token){
		return res.status(401).json({error: 'No token Provided'});
	}
	try{
		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET as string
		) as {userId: number; email: string};
		req.userId = decoded.userId;
		req.email = decoded.email;
		next();
	}catch(err){
		return res.status(403).json({error: 'Invalid or expired token'});
	}
};
