// backend/src/routes/userConfigRoutes.ts
import express, { Response, NextFunction } from 'express'; // Ensure 'express' is imported for 'Response'
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { supabaseAdminClient } from '../config/appConfig';
import { getUserGeminiApiKey, setUserGeminiApiKey } from '../services/userApiKeyService';

const router = express.Router();

// POST /api/user-config/gemini-key
router.post('/gemini-key', async (
    req: AuthenticatedRequest,
    res: Response, // Using express.Response
    next: NextFunction
): Promise<void> => { // Explicit return type
    const { apiKey } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        res.status(403).json({ success: false, error: 'User not authenticated.' });
        return; // Ensure to return after sending response
    }
    if (typeof apiKey !== 'string') {
        res.status(400).json({ success: false, error: 'apiKey (string) is required in the body.' });
        return;
    }
    if (!supabaseAdminClient) {
        res.status(500).json({ success: false, error: 'Server configuration error (admin client).' });
        return;
    }

    try {
        const result = await setUserGeminiApiKey(userId, apiKey, supabaseAdminClient);
        if (result.success) {
            res.status(200).json({ success: true, message: 'Gemini API key updated successfully.' });
        } else {
            res.status(500).json({ success: false, error: result.error || 'Failed to update Gemini API key.' });
        }
    } catch (error) {
        next(error);
    }
});

// GET /api/user-config/gemini-key-status
router.get('/gemini-key-status', async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => { // Explicit return type
    const userId = req.user?.id;

    if (!userId) {
        res.status(403).json({ success: false, error: 'User not authenticated.' });
        return;
    }
    if (!supabaseAdminClient) {
        res.status(500).json({ success: false, error: 'Server configuration error (admin client).' });
        return;
    }

    try {
        const apiKey = await getUserGeminiApiKey(userId, supabaseAdminClient);
        res.status(200).json({ success: true, hasKey: !!apiKey });
    } catch (error) {
        next(error);
    }
});

export default router;