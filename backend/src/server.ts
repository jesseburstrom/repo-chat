// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import configurations and initializers
import {
    GENERATED_FILES_DIR,
    getCurrentModelCallName,
    // initGeneratedFilesDir and loadLastSelectedModel are called on import by appConfig.ts
} from './config/appConfig';

// Import route handlers
import fileRoutes from './routes/fileRoutes';
import repomixRoutes from './routes/repomixRoutes';
import geminiRoutes from './routes/geminiRoutes';
import { authenticateToken, AuthenticatedRequest } from './middleware/authMiddleware';

const app = express();
const port = process.env.PORT || 8003; // Use environment variable for port if available

const corsOptions = {
    origin: ['http://localhost:5173', 'https://fluttersystems.com'], // Consider making this configurable
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Mount routers WITH authentication middleware
// Note: You might want some routes to be public, adjust as needed.
// For example, listing generated files might be public, but getting content might be protected.
// Or, /api/gemini-config might be public.
app.use('/api', authenticateToken, fileRoutes);
app.use('/api', authenticateToken, repomixRoutes);
app.use('/api', authenticateToken, geminiRoutes);


// Basic Root Route
app.get('/api', (req, res) => { // Changed to /api as well for consistency
    res.send('Repomix API Server is running.');
});
app.get('/', (req, res) => { // Keep a root for simple health check if needed
    res.send('Repomix Server (root) is running. API is at /api');
});


// Global error handler (must be last)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Global error handler caught:", err.stack);
    if (!res.headersSent) {
        // Check if it's a Gemini API error with more details
        if ((err as any).message?.includes('GEMINI_API_ERROR')) { // Example check
             res.status(502).json({ success: false, error: `Gemini API Error: ${(err as any).message}` });
        } else {
            res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
        }
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Repomix server listening on http://localhost:${port}`);
    console.log(`Repomix output will be saved to: ${GENERATED_FILES_DIR}`);
    console.log(`Default/Last selected Gemini model: ${getCurrentModelCallName()}`);
});

