// repomix-server/src/server.ts
import express, { Request, Response, NextFunction, RequestHandler } from 'express'; // <-- Import RequestHandler
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

const app = express();
const port = 8003; // Use a different port than the React app

const GENERATED_FILES_DIR = path.resolve(__dirname, '..', '..', 'generated_files');
const BASE_FILENAME = 'full_description'; // Base part of the filename
const FILENAME_EXTENSION = '.md';

// --- Helper Function to generate safe filename from URL ---
function generateFilenameFromUrl(repoUrl: string): { success: boolean; filename?: string; error?: string } {
    try {
        const url = new URL(repoUrl);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0); // Split and remove empty parts

        if (pathParts.length < 2) {
            throw new Error('URL path does not contain user/org and repository name.');
        }

        const userOrOrg = pathParts[pathParts.length - 2];
        const repoName = pathParts[pathParts.length - 1].replace(/\.git$/, ''); // Remove trailing .git

        if (!userOrOrg || !repoName) {
             throw new Error('Could not extract user/org or repository name from URL path.');
        }

        // Sanitize parts to be filename-safe
        // Replace non-alphanumeric (excluding hyphen) with underscore, collapse multiple underscores
        const sanitize = (part: string) => part.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');

        const safeUser = sanitize(userOrOrg);
        const safeRepo = sanitize(repoName);

        if (!safeUser || !safeRepo) {
            throw new Error('Sanitized user/org or repository name is empty.');
        }


        const dynamicFilename = `${BASE_FILENAME}_${safeUser}_${safeRepo}${FILENAME_EXTENSION}`;
        return { success: true, filename: dynamicFilename };

    } catch (error: any) {
        console.error("Error parsing URL or generating filename:", error);
        return { success: false, error: `Invalid repository URL format or content: ${error.message}` };
    }
}
// --- End Helper Function ---

// --- CORS Configuration ---
// Be specific in production. For development, allow React dev server origin.
const corsOptions = {
    origin: ['http://localhost:5173', 'https://fluttersystems.com'], // Allow React dev server and your potential prod domain
    methods: ['POST', 'OPTIONS'], // Only allow POST and OPTIONS pre-flight
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

// --- Middleware ---
app.use(bodyParser.json());

// --- Ensure output directory exists ---
if (!fs.existsSync(GENERATED_FILES_DIR)) {
  console.log(`Creating directory for generated files: ${GENERATED_FILES_DIR}`);
  try {
    fs.mkdirSync(GENERATED_FILES_DIR, { recursive: true });
  } catch (err) {
     console.error("FATAL: Could not create generated_files directory.", err);
     process.exit(1); // Exit if we can't create the essential directory
  }
}
// --- End Directory Setup ---

// --- Request Body Interface ---
interface RunRepomixRequestBody {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}

// --- Repomix Endpoint ---
const handleRunRepomix = (
    // APPLY types directly to parameters
    req: Request<{}, {}, RunRepomixRequestBody>,
    res: Response,
    next: NextFunction // Keep next parameter
): void => { // Explicitly state the function returns void
    const { repoUrl, includePatterns, excludePatterns } = req.body;

    if (!repoUrl) {
        res.status(400).json({ success: false, error: 'repoUrl is required' });
        return; // Explicitly return void here
    }

    // --- Generate Dynamic Filename ---
    const filenameResult = generateFilenameFromUrl(repoUrl);
    if (!filenameResult.success || !filenameResult.filename) {
        res.status(400).json({ success: false, error: filenameResult.error || 'Failed to generate filename from URL.' });
        return;
    }
    const dynamicOutputFilename = filenameResult.filename;
    const fullDynamicOutputPath = path.join(GENERATED_FILES_DIR, dynamicOutputFilename);
    console.log(`Target output path: ${fullDynamicOutputPath}`);
    // --- End Filename Generation ---

    // Command construction logic... uses fullDynamicOutputPath now
    const repomixExecutable = "repomix";
    let command = `${repomixExecutable} --remote "${repoUrl}" --output "${fullDynamicOutputPath}" --no-file-summary`; // Use dynamic path
    if (includePatterns) command += ` --include "${includePatterns}"`;
    if (excludePatterns) command += ` --ignore "${excludePatterns}"`;

    console.log(`Executing Repomix: ${command}`);

    // Delete existing file logic...
    if (fs.existsSync(fullDynamicOutputPath)) {
        try {
            fs.unlinkSync(fullDynamicOutputPath);
            console.log(`Deleted existing file: ${fullDynamicOutputPath}`);
        } catch (e) {
            console.error("Failed to delete existing output file:", e);
        }
    }

    // Execute the command logic...
    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Repomix execution error: ${error.message}`);
            console.error(`Repomix stderr: ${stderr}`);
            if (fs.existsSync(fullDynamicOutputPath)) {
                 try { fs.unlinkSync(fullDynamicOutputPath); } catch (e) { console.error("Failed to delete partial output file on error:", e); }
            }
            // Check if headers are already sent before sending error response
            if (!res.headersSent) {
                 res.status(500).json({
                    success: false,
                    error: `Repomix execution failed: ${error.message}`,
                    stderr: stderr
                });
            } else {
                 console.error("Headers already sent, could not send exec error response.");
            }
            return; // Important: return from callback
        }

        if (stderr) {
            console.warn(`Repomix stderr output: ${stderr}`);
        }
        console.log(`Repomix stdout: ${stdout}`);

        // Verify File Creation logic...
        if (!fs.existsSync(fullDynamicOutputPath)) {
            console.error(`Repomix command finished but output file not found: ${fullDynamicOutputPath}`);
             if (!res.headersSent) {
                 res.status(500).json({
                    success: false,
                    error: 'Repomix finished, but the output file was not created.',
                    stdout: stdout,
                    stderr: stderr
                });
             } else {
                  console.error("Headers already sent, could not send file not found error response.");
             }
            return; // Important: return from callback
        }

        console.log(`Repomix successfully generated: ${fullDynamicOutputPath}`);
         if (!res.headersSent) {
             res.status(200).json({
                success: true,
                // --- Update message to include the specific filename ---
                message: `Repomix completed. Output saved to server as ${dynamicOutputFilename}. Attach this file manually to the chat.`,
                outputFilename: dynamicOutputFilename // Return the actual filename generated
            });
         }
    });

    // The main handler function implicitly returns void here, satisfying the type system
    // without needing to wrap the whole thing in an async/await structure for this case.
};

// Use the handler in app.post (no change needed here)
app.post('/run-repomix', handleRunRepomix);

// --- Basic Root Route ---
app.get('/', (req, res) => {
    res.send('Repomix Server is running.');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Repomix server listening on http://localhost:${port}`);
    console.log(`Repomix output will be saved to: ${GENERATED_FILES_DIR}`);
});