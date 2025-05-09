// backend/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { supabaseBackendClient } from '../config/appConfig'; // Using the client for getUser

export interface AuthenticatedRequest extends Request {
    user?: any; // Define a more specific user type based on Supabase user object
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => { // Explicitly type return as Promise<void>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        res.status(401).json({ success: false, error: 'No token provided.' });
        return; // Add return here
    }

    if (!supabaseBackendClient) {
        console.error("Supabase backend client not initialized for authentication.");
        res.status(500).json({ success: false, error: 'Authentication service misconfiguration.' });
        return; // Add return here
    }

    try {
        // Verify token using Supabase client's getUser method
        const { data: { user }, error } = await supabaseBackendClient.auth.getUser(token);

        if (error || !user) {
            console.warn('Token verification failed or no user found:', error?.message);
            res.status(403).json({ success: false, error: 'Invalid or expired token.' });
            return; // Add return here
        }

        req.user = user; // Add user object to request
        next();
    } catch (err: any) {
        console.error("Error during token authentication:", err);
        res.status(500).json({ success: false, error: 'Server error during authentication.' });
        return; // Add return here
    }
};