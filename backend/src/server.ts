// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';

dotenv.config();

import {
    GENERATED_FILES_DIR,
    // supabaseAdminClient // Not directly used here, but initialized in appConfig
} from './config/appConfig';

import { DEFAULT_MODEL_CALL_NAME } from './geminiModels';

import fileRoutes from './routes/fileRoutes';
import repomixRoutes from './routes/repomixRoutes';
import geminiRoutes from './routes/geminiRoutes';
import userConfigRoutes from './routes/userConfigRoutes'; // Import new routes
import { authenticateToken, AuthenticatedRequest } from './middleware/authMiddleware';

const app = express();
const port = process.env.PORT || 8003;

const corsOptions = {
    origin: ['http://localhost:5173', 'https://fluttersystems.com'],
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'], // Added DELETE for API key removal
    allowedHeaders: ['Content-Type', 'Authorization'], // Added Authorization
};
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Mount routers WITH authentication middleware
app.use('/api', authenticateToken, fileRoutes);
app.use('/api', authenticateToken, repomixRoutes);
app.use('/api', authenticateToken, geminiRoutes);
app.use('/api/user-config', authenticateToken, userConfigRoutes); // Mount new routes

app.get('/api', (req, res) => {
    res.send('Repomix API Server is running.');
});
app.get('/', (req, res) => {
    res.send('Repomix Server (root) is running. API is at /api');
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Global error handler caught:", err.stack);
    if (!res.headersSent) {
        if ((err as any).status === 402 && (err as any).message?.includes('Gemini API key not configured')) {
             res.status(402).json({ success: false, error: (err as any).message });
        } else if ((err as any).message?.includes('GEMINI_API_ERROR') || (err as any).message?.includes('Gemini API Key Error')) {
             res.status(502).json({ success: false, error: (err as any).message });
        } else {
            res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
        }
    }
});

app.listen(port, () => {
    console.log(`Repomix server listening on http://localhost:${port}`);
    console.log(`Repomix output will be saved to: ${GENERATED_FILES_DIR}`);
    console.log(`Default Gemini model (fallback): ${DEFAULT_MODEL_CALL_NAME}`);
    // console.log(`Supabase Admin Client ${supabaseAdminClient ? 'initialized' : 'NOT initialized'}`);
});