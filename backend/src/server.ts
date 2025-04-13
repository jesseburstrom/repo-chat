// repomix-server/src/server.ts
import express, { Request, Response, NextFunction } from 'express'; // <-- Import RequestHandler
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as fs from 'fs';
import { constants as fsConstants } from 'fs'; 
import { exec } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content, FinishReason, SafetyRating } from "@google/generative-ai";

const geminiApiKey: string = process.env.GEMINI_API_KEY as string;
if (!geminiApiKey) {
  console.error("FATAL: GEMINI_API_KEY not found in server environment variables.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const generationConfig: GenerationConfig = { /* ... your config ... */ };
const safetySettings = [ /* ... your settings ... */ ];
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-exp-03-25",
    // safetySettings, // Apply safety settings if needed
    generationConfig,
});

const app = express();
const port = 8003; // Use a different port than the React app

// --- CORS Configuration ---
// Be specific in production. For development, allow React dev server origin.
const corsOptions = {
    origin: ['http://localhost:5173', 'https://fluttersystems.com'], // Allow React dev server and your potential prod domain
    methods: ['POST', 'OPTIONS'], // Only allow POST and OPTIONS pre-flight
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

// --- Increase Body Parser Limit ---
// Apply BEFORE your routes that handle large POST bodies
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit (e.g., to 10MB)
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); // For urlencoded bodies too, if needed
// --- End Body Parser Limit Increase ---


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

// --- NEW Endpoint: List Generated Repo Files ---
app.get('/list-generated-files', async (req: Request, res: Response, next: NextFunction) => {
    console.log(`Request received for /list-generated-files`);
    try {
        const files = await fs.promises.readdir(GENERATED_FILES_DIR);
        const repoFiles = files
            .map(filename => {
                // Match pattern and capture user/org and repo parts
                const match = filename.match(/^full_description_(.+?)_(.+)\.md$/);
                if (match && match[1] && match[2]) {
                    // Reconstruct identifier - assumes underscores in user/repo were replaced by single underscore
                    // This might need adjustment if repo names have underscores originally
                    const repoIdentifier = `${match[1]}/${match[2]}`;
                    return { filename, repoIdentifier };
                }
                return null; // Exclude files that don't match
            })
            .filter(item => item !== null); // Remove null entries

        console.log(`Found ${repoFiles.length} matching files.`);
        res.status(200).json({ success: true, data: repoFiles });

    } catch (error: any) {
        console.error("Error listing generated files:", error);
        if (error.code === 'ENOENT') {
            // Directory doesn't exist, return empty list gracefully
            console.log("Generated files directory not found, returning empty list.");
            res.status(200).json({ success: true, data: [] });
        } else {
            next(error); // Pass other errors to error handler
        }
    }
});
// --- End List Endpoint ---

// Define the async handler function separately
const handleGetFileContent = async ( // <-- Add async here
    req: Request<{ filename: string }>, // <-- Type route parameter
    res: Response,
    next: NextFunction
): Promise<void> => { // <-- Explicit Promise<void> return
    const requestedFilename = req.params.filename;
    console.log(`Request received for /get-file-content/${requestedFilename}`);

    // ** Stronger Security Validation **
    const safeFilenameRegex = /^[a-zA-Z0-9_.-]+\.md$/;
    const resolvedPath = path.join(GENERATED_FILES_DIR, requestedFilename);
    const normalizedPath = path.normalize(resolvedPath);

    // 1. Check basic format
    if (!requestedFilename || !safeFilenameRegex.test(requestedFilename)) {
        console.warn(`Attempt to get content for invalid filename format: ${requestedFilename}`);
        res.status(400).json({ success: false, error: 'Invalid filename format.' });
        return; // Explicit void return
    }

    // 2. Prevent path traversal
    if (!normalizedPath.startsWith(GENERATED_FILES_DIR)) {
        console.error(`Path traversal attempt detected: ${requestedFilename} resolved to ${normalizedPath}`);
        res.status(400).json({ success: false, error: 'Invalid filename.' });
        return; // Explicit void return
    }

    try {
        // 3. Check if file exists and is accessible
        await fs.promises.access(normalizedPath, fsConstants.R_OK);

        // 4. Read file content
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');
        console.log(`Successfully read content for ${requestedFilename}. Length: ${content.length}`);
        res.status(200).json({ success: true, content: content });
        // Implicit void return after sending response

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`Content request for non-existent file: ${normalizedPath}`);
            res.status(404).json({ success: false, error: 'File not found.' });
            // No explicit return needed before next()
        } else if (error.code === 'EACCES') {
             console.error(`Permission denied reading file: ${normalizedPath}`);
             res.status(500).json({ success: false, error: 'Could not read file (permission issue).' });
             // No explicit return needed before next()
        }
        else {
            console.error(`Error getting file content for ${requestedFilename}:`, error);
            next(error); // Pass other errors to error handler
        }
        // Let execution fall through to implicitly return void after handling error or calling next()
    }
};

// Use the handler constant with app.get
app.get('/get-file-content/:filename', handleGetFileContent);
// --- End Get Content Endpoint ---

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

    // --- Use npx to execute local repomix ---
    const repomixExecutable = "npx repomix"; // Use npx

    let command = `${repomixExecutable} --remote "${repoUrl}" --output "${fullDynamicOutputPath}" --no-file-summary`; // Use dynamic path
    if (includePatterns) command += ` --include "${includePatterns}"`;
    if (excludePatterns) command += ` --ignore "${excludePatterns}"`;

    console.log(`Executing Repomix via npx: ${command}`); // Updated log message

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

interface CallGeminiRequestBody {
    history: Content[]; // Expect history in the correct format
    newMessage: string;
}

const handleCallGemini = async ( // Keep async
    // Type parameters directly
    req: Request<{}, {}, CallGeminiRequestBody>,
    res: Response,
    next: NextFunction
): Promise<void> => { // Explicitly declare it returns Promise<void>
    const { history, newMessage } = req.body;

    if (!newMessage) {
        res.status(400).json({ success: false, error: 'newMessage is required.' });
        return; // Return void
    }
    if (!Array.isArray(history)) {
         res.status(400).json({ success: false, error: 'history must be an array.' });
         return; // Return void
    }

    console.log("Received Gemini request. History length:", history.length, "New message:", newMessage.substring(0, 50) + "...");

    try {
         const chatSession = model.startChat({ history });
         const result = await chatSession.sendMessage(newMessage);
         const response = result.response;

         // --- Detailed error/block handling ---
         if (response.promptFeedback?.blockReason) {
             const reason = response.promptFeedback.blockReason;
             console.error(`Gemini Prompt blocked: ${reason}`);
             res.status(400).json({ success: false, error: `Prompt blocked by safety filter: ${reason}` });
             return; // Return void
         }
         const candidates = response.candidates;
          if (!candidates || candidates.length === 0) {
              console.error("Gemini returned no candidates.");
              res.status(500).json({ success: false, error: 'Gemini API returned no response candidates.' });
              return; // Return void
          }
          const firstCandidate = candidates[0];
          if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
               console.error(`Gemini response stopped: ${firstCandidate.finishReason}`);
               res.status(400).json({ success: false, error: `Response stopped due to ${firstCandidate.finishReason}` });
               return; // Return void
          }
          if (!firstCandidate.content?.parts || firstCandidate.content.parts.length === 0 || !firstCandidate.content.parts.some(p => p.text)) {
              console.error("Gemini returned no text content.");
              res.status(500).json({ success: false, error: 'Gemini API returned no text content.' });
              return; // Return void
          }
         // --- End checks ---

         const responseText = response.text();
         res.status(200).json({ success: true, text: responseText });
         // Implicit void return after sending response

    } catch (error: any) {
        console.error("Error calling Gemini API on server:", error);
        // Pass error to middleware, this implicitly returns void from the catch block
        next(error);
    }
    // The async function implicitly returns Promise<void> if all paths either
    // return void, don't return anything (implicitly void), or throw/call next().
};

// Use the async handler constant
app.post('/call-gemini', handleCallGemini);
// --- End Gemini Proxy Endpoint ---
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