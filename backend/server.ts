// server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs'; // <-- Add fs import
import { exec } from 'child_process'; // <-- Add child_process import
import FormData from 'form-data';
import { IncomingMessage } from 'http';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const apiKey: string = process.env.OPENAI_API_KEY as string;
// Assume OPENAI_API_KEY check is already done

// --- Globals / State ---
const conversations: Record<string, { /* ... */ }> = {};
let currentConversationName: string | null = null;
const GENERATED_FILES_DIR = path.join(__dirname, 'generated_files'); // Define output directory
const REPOMIX_OUTPUT_FILENAME = 'full_description.md'; // Predefined output filename

// --- Ensure output directory exists ---
if (!fs.existsSync(GENERATED_FILES_DIR)) {
  console.log(`Creating directory for generated files: ${GENERATED_FILES_DIR}`);
  fs.mkdirSync(GENERATED_FILES_DIR, { recursive: true });
}
// --- End Directory Setup ---


const app = express();
app.use(cors({
  // ... cors options
}));
const port = 8002;
const base_route = '/assistant';

app.use(bodyParser.json({ limit: '50mb' }));

// --- OpenAI API Call Helpers (Keep existing functions) ---
// async function makeOpenAIRequest ...
// async function uploadFile ...
// async function createResponse ...
// async function getResponse ...
// async function deleteResponse ...
// function extractTextFromResponse ...

// --- Express Routes ---

// ... (Keep existing routes: /start-conversation, /interact, /delete-conversation, etc.) ...


// --- NEW Repomix Endpoint ---
interface RunRepomixRequestBody {
    repoUrl: string;
    includePatterns?: string; // Comma-separated string
    excludePatterns?: string; // Comma-separated string
}

app.post(base_route + '/run-repomix', (req: Request<{}, {}, RunRepomixRequestBody>, res: Response) => {
    const { repoUrl, includePatterns, excludePatterns } = req.body;

    if (!repoUrl) {
        return res.status(400).json({ success: false, error: 'repoUrl is required' });
    }

    const outputPath = path.join(GENERATED_FILES_DIR, REPOMIX_OUTPUT_FILENAME);

    // --- Construct the repomix command ---
    // IMPORTANT: Ensure 'repomix' is in your server's PATH or provide the full path.
    // Using npx might be safer if repomix is a project dependency: `npx repomix ...`
    // This example assumes 'repomix' is globally available in the PATH.
    let command = `repomix --remote "${repoUrl}" --output "${outputPath}" --no-file-summary`; // Base command

    if (includePatterns) {
        command += ` --include "${includePatterns}"`;
    }
    if (excludePatterns) {
        command += ` --ignore "${excludePatterns}"`; // repomix uses --ignore
    }

    console.log(`Executing Repomix: ${command}`);

    // --- Execute the command ---
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Repomix execution error: ${error.message}`);
            console.error(`Repomix stderr: ${stderr}`);
            // Try to delete partial output file on error
            if (fs.existsSync(outputPath)) {
                 try { fs.unlinkSync(outputPath); } catch (e) { console.error("Failed to delete partial output file:", e); }
            }
            return res.status(500).json({
                success: false,
                error: `Repomix execution failed: ${error.message}`,
                stderr: stderr
            });
        }

        if (stderr) {
            // Repomix might write warnings to stderr even on success
            console.warn(`Repomix stderr output: ${stderr}`);
        }

        console.log(`Repomix stdout: ${stdout}`);
        console.log(`Repomix successfully generated: ${outputPath}`);

        // --- Check if file was actually created ---
        if (!fs.existsSync(outputPath)) {
             console.error(`Repomix command finished but output file not found: ${outputPath}`);
             return res.status(500).json({
                 success: false,
                 error: 'Repomix finished but the output file was not created.',
                 stdout: stdout,
                 stderr: stderr
             });
        }

        res.status(200).json({
            success: true,
            message: `Repomix completed. Output saved to server as ${REPOMIX_OUTPUT_FILENAME}. Please attach this file manually.`,
            outputFilename: REPOMIX_OUTPUT_FILENAME // Send back the filename
            // DO NOT send file content here - let user attach it.
        });
    });
});
// --- End Repomix Endpoint ---


// --- Static Files & Fallback (Keep existing) ---
// app.use(...)
// app.get('*', ...)

// --- Server Start (Keep existing) ---
// app.listen(...)

// --- Export necessary functions if you split files later ---
// (Currently not needed as it's one file)