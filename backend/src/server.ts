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
    model: "gemini-2.5-pro-preview-03-25",
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
const TEMP_FILENAME_PREFIX = 'temp_repomix_output'; // Keep using temp prefix
const MAIN_FILENAME_EXTENSION = '.md';
const SUMMARY_FILENAME_EXTENSION = '.txt';
const SUMMARY_FILENAME_SUFFIX = '_pack_summary';

// --- Helper Function to generate safe base filename parts from URL ---
// Returns user/org and repo name, sanitized.
function generateSafeRepoPartsFromUrl(repoUrl: string): { success: boolean; safeUser?: string; safeRepo?: string; error?: string } {
    try {
        const url = new URL(repoUrl);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);

        if (pathParts.length < 2) {
            throw new Error('URL path does not contain user/org and repository name.');
        }

        const userOrOrg = pathParts[pathParts.length - 2];
        const repoName = pathParts[pathParts.length - 1].replace(/\.git$/, '');

        if (!userOrOrg || !repoName) {
             throw new Error('Could not extract user/org or repository name from URL path.');
        }

        // Sanitize parts: replace non-alphanumeric (excluding hyphen) with underscore, collapse multiple underscores
        const sanitize = (part: string) => part.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');

        const safeUser = sanitize(userOrOrg);
        const safeRepo = sanitize(repoName);

        if (!safeUser || !safeRepo) {
            throw new Error('Sanitized user/org or repository name is empty.');
        }

        return { success: true, safeUser, safeRepo };

    } catch (error: any) {
        console.error("Error parsing URL or generating filename parts:", error);
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

// --- Endpoint: /list-generated-files ---
// MODIFIED: Only list the main .md files, not summary files.
app.get('/list-generated-files', async (req: Request, res: Response, next: NextFunction) => {
    console.log(`Request received for /list-generated-files`);
    try {
        const files = await fs.promises.readdir(GENERATED_FILES_DIR);
        const repoFiles = files
            .map(filename => {
                // Match SIMPLE pattern: user_repo.md (excluding _pack_summary.txt)
                // Ensure it DOES NOT end with the summary suffix + txt extension
                // Ensure it DOES end with the main markdown extension
                const isSummaryFile = filename.endsWith(`${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`);
                const isMainFile = filename.endsWith(MAIN_FILENAME_EXTENSION);

                if (isMainFile && !isSummaryFile) {
                    // Extract user/repo (assuming format user_repo.md)
                    const baseName = filename.slice(0, -MAIN_FILENAME_EXTENSION.length);
                     // Split by the LAST underscore, assuming repo name doesn't have underscores
                     // A more robust way might be needed if repo names have underscores,
                     // but this matches the current 'safeRepo' generation.
                     const parts = baseName.split('_');
                     if (parts.length >= 2) {
                        const user = parts.slice(0, -1).join('_'); // Handle underscores in user/org name
                        const repo = parts[parts.length - 1];
                        const repoIdentifier = `${user}/${repo}`;
                        return { filename, repoIdentifier };
                     }
                }
                return null; // Exclude summary files and non-matching files
            })
            .filter(item => item !== null) // Remove null entries
            .sort((a, b) => (a!.repoIdentifier).localeCompare(b!.repoIdentifier)); // Sort

        console.log(`Found ${repoFiles.length} main repo files.`);
        res.status(200).json({ success: true, data: repoFiles });

    } catch (error: any) {
        console.error("Error listing generated files:", error);
        if (error.code === 'ENOENT') {
            console.log("Generated files directory not found, returning empty list.");
            res.status(200).json({ success: true, data: [] });
        } else {
            next(error);
        }
    }
});
// --- End List Endpoint ---

// --- Endpoint: /get-file-content ---
// MODIFIED: Update validation logic if needed, though path traversal is key
const handleGetFileContent = async (
    req: Request<{ filename: string }>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const requestedFilename = req.params.filename;
    console.log(`Request received for /get-file-content/${requestedFilename}`);

    // Basic safety checks - allow .md or _pack_summary.txt files
    // Looser regex, focus on path traversal prevention primarily
    const safeFilenameRegex = /^[a-zA-Z0-9_.-]+(\.md|_pack_summary\.txt)$/;
    const resolvedPath = path.join(GENERATED_FILES_DIR, requestedFilename);
    const normalizedPath = path.normalize(resolvedPath);

    if (!requestedFilename || requestedFilename.includes('/') || requestedFilename.includes('..')) {
         console.warn(`Attempt to get content for invalid filename format: ${requestedFilename}`);
         res.status(400).json({ success: false, error: 'Invalid filename format.' });
         return;
    }
     if (!safeFilenameRegex.test(requestedFilename)) {
        console.warn(`Filename does not match expected pattern: ${requestedFilename}`);
        // Allow fetching for now? Or reject? Let's be slightly stricter
         // res.status(400).json({ success: false, error: 'Filename does not match expected pattern.' });
         // return;
     }
    if (!normalizedPath.startsWith(GENERATED_FILES_DIR)) {
        console.error(`Path traversal attempt detected: ${requestedFilename} resolved to ${normalizedPath}`);
        res.status(400).json({ success: false, error: 'Invalid filename.' });
        return;
    }

    try {
        await fs.promises.access(normalizedPath, fsConstants.R_OK);
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');
        console.log(`Successfully read content for ${requestedFilename}. Length: ${content.length}`);
        res.status(200).json({ success: true, content: content });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`Content request for non-existent file: ${normalizedPath}`);
            res.status(404).json({ success: false, error: 'File not found.' });
        } else if (error.code === 'EACCES') {
             console.error(`Permission denied reading file: ${normalizedPath}`);
             res.status(500).json({ success: false, error: 'Could not read file (permission issue).' });
        }
        else {
            console.error(`Error getting file content for ${requestedFilename}:`, error);
            next(error);
        }
    }
};
app.get('/get-file-content/:filename', handleGetFileContent);
// --- End Get Content Endpoint ---

// --- Request Body Interface ---
interface RunRepomixRequestBody {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}

// --- Repomix Endpoint ---
// ADDED ANSI code stripping for summary file
const handleRunRepomix = (
    req: Request<{}, {}, RunRepomixRequestBody>,
    res: Response,
    next: NextFunction
): void => {
    const { repoUrl, includePatterns, excludePatterns } = req.body;

    if (!repoUrl) {
        res.status(400).json({ success: false, error: 'repoUrl is required' });
        return;
    }

    // Generate Base Safe Parts
    const repoPartsResult = generateSafeRepoPartsFromUrl(repoUrl);
    if (!repoPartsResult.success || !repoPartsResult.safeUser || !repoPartsResult.safeRepo) {
        res.status(400).json({ success: false, error: repoPartsResult.error || 'Failed to generate filename parts from URL.' });
        return;
    }
    const { safeUser, safeRepo } = repoPartsResult;

    // Define Filenames
    const mainBaseFilename = `${safeUser}_${safeRepo}`;
    const finalMainFilename = `${mainBaseFilename}${MAIN_FILENAME_EXTENSION}`;
    const summaryFilename = `${mainBaseFilename}${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`;
    const tempOutputFilename = `${TEMP_FILENAME_PREFIX}_${mainBaseFilename}_${Date.now()}${MAIN_FILENAME_EXTENSION}`;

    const tempFullOutputPath = path.join(GENERATED_FILES_DIR, tempOutputFilename);
    const finalMainFullOutputPath = path.join(GENERATED_FILES_DIR, finalMainFilename);
    const summaryFullOutputPath = path.join(GENERATED_FILES_DIR, summaryFilename);

    console.log(`Temporary output path: ${tempFullOutputPath}`);
    console.log(`Final main output path: ${finalMainFullOutputPath}`);
    console.log(`Summary output path: ${summaryFullOutputPath}`);

    const repomixExecutable = "npx repomix";

    // Command
    let command = `${repomixExecutable} --remote "${repoUrl}" --output "${tempFullOutputPath}" --style plain`;
    if (includePatterns) command += ` --include "${includePatterns}"`;
    if (excludePatterns) command += ` --ignore "${excludePatterns}"`;

    console.log(`Executing Repomix via npx: ${command}`);

    // Delete existing temp file
    if (fs.existsSync(tempFullOutputPath)) {
        try { fs.unlinkSync(tempFullOutputPath); } catch (e) { console.warn("Could not delete pre-existing temp file:", e); }
    }

    // Execute the command
    exec(command, { timeout: 300000, maxBuffer: 1024 * 1024 * 5 /* 5MB buffer */ }, async (error, stdout, stderr) => {
        if (error) {
            // ... (error handling as before) ...
             console.error(`Repomix execution error: ${error.message}`);
             console.error(`Repomix stderr: ${stderr}`);
             console.error(`Repomix stdout (on error): ${stdout}`);
             if (fs.existsSync(tempFullOutputPath)) {
                  try { fs.unlinkSync(tempFullOutputPath); } catch (e) { console.error("Failed to delete temp output file on error:", e); }
             }
             if (!res.headersSent) {
                  res.status(500).json({ success: false, error: `Repomix execution failed: ${error.message}`, stderr: stderr, stdout: stdout });
             } else {
                  console.error("Headers already sent, could not send exec error response.");
             }
            return;
        }

        // Log raw stdout just once for reference if needed
        // console.log(`Repomix stdout (raw):\n${stdout}`);
        if (stderr) {
            console.warn(`Repomix stderr output:\n${stderr}`);
        }

        // Verify Temp File Creation
        if (!fs.existsSync(tempFullOutputPath)) {
            // ... (error handling as before) ...
             console.error(`Repomix command finished but temp output file not found: ${tempFullOutputPath}`);
              if (!res.headersSent) {
                  res.status(500).json({ success: false, error: 'Repomix finished, but the temporary output file was not created.', stdout: stdout, stderr: stderr });
              } else {
                   console.error("Headers already sent, could not send file not found error response.");
              }
            return;
        }

        // --- Process Files: Extract Summary, Clean it, Save Summary, Rename Main ---
        let summarySaved = false; // Track if summary was saved
        let extractedSummaryString = ''; // Keep original extracted block
        let cleanedSummaryString = ''; // Store the cleaned version

        try {
            // 1. Extract Summary from stdout
            const lines = stdout.split('\n');
            let summaryStartIndex = -1;
            let summaryEndIndex = -1; // Exclusive index
            const startMarker = 'pack summary'; // Case-insensitive
            const endMarker = '🎉 all done!'; // Case-insensitive

            for (let i = 0; i < lines.length; i++) {
                const lineLower = lines[i].toLowerCase();
                if (summaryStartIndex === -1 && lineLower.includes(startMarker)) {
                    summaryStartIndex = i;
                }
                if (summaryStartIndex !== -1 && lineLower.includes(endMarker) && i > summaryStartIndex) {
                    summaryEndIndex = i;
                    break;
                }
            }

            if (summaryStartIndex !== -1) {
                const endIndexForSlice = summaryEndIndex === -1 ? lines.length : summaryEndIndex;
                extractedSummaryString = lines.slice(summaryStartIndex, endIndexForSlice).join('\n').trim();
                console.log(`Extracted raw summary block (approx ${extractedSummaryString.length} chars).`);

                // *** 2. Clean ANSI Codes ***
                // Regex to remove ANSI escape codes (like \u001b[37m)
                const ansiRegex = /\u001b\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGKHF]/g;
                cleanedSummaryString = extractedSummaryString.replace(ansiRegex, '');
                console.log(`Cleaned summary block (approx ${cleanedSummaryString.length} chars).`);
                // Optional: Log first few lines of cleaned summary
                // console.log(`Cleaned Summary Start:\n${cleanedSummaryString.split('\n').slice(0,5).join('\n')}`);

            } else {
                console.warn("Could not find start of Pack Summary block in stdout. Summary file will not be created.");
            }

            // 3. Save Cleaned Summary File (if available)
            if (cleanedSummaryString) { // Use the cleaned string
                try {
                    // Overwrite summary file if it exists
                    if (fs.existsSync(summaryFullOutputPath)) {
                        console.warn(`Summary file ${summaryFilename} already exists. Overwriting.`);
                    }
                    // *** SAVE CLEANED STRING ***
                    await fs.promises.writeFile(summaryFullOutputPath, cleanedSummaryString, 'utf-8');
                    console.log(`Cleaned pack summary saved successfully to: ${summaryFilename}`);
                    summarySaved = true;
                } catch (writeErr: any) {
                    console.error(`Failed to write summary file ${summaryFilename}:`, writeErr);
                }
            }

            // 4. Rename Main Temp File to Final Name
            // ... (Overwrite check logic as before) ...
             if (fs.existsSync(finalMainFullOutputPath)) {
                 console.warn(`Main output file ${finalMainFilename} already exists. Overwriting.`);
                 try {
                     await fs.promises.unlink(finalMainFullOutputPath);
                 } catch (unlinkErr: any) {
                     console.error(`Failed to delete existing main file ${finalMainFilename} before overwrite:`, unlinkErr);
                 }
             }
            await fs.promises.rename(tempFullOutputPath, finalMainFullOutputPath);
            console.log(`Main repomix output successfully saved as: ${finalMainFilename}`);

        } catch (processingError: any) {
            console.error(`Error processing stdout or renaming/saving files:`, processingError);
             if (fs.existsSync(tempFullOutputPath)) {
                 try { await fs.promises.unlink(tempFullOutputPath); } catch (e) { console.error("Failed to delete temp file after processing error:", e); }
             }
            if (!res.headersSent) {
                 res.status(500).json({ success: false, error: `Failed during file processing: ${processingError.message}` });
            } else {
                 console.error("Headers already sent, could not send file processing error response.");
            }
            return; // Stop execution here
        }
        // --- End Processing ---

        // --- Success Response ---
        let successMessage = `Repomix completed. Main output saved as ${finalMainFilename}.`;
        if (summarySaved) {
            successMessage += ` Cleaned summary saved as ${summaryFilename}.`;
        } else if (cleanedSummaryString) { // Use cleaned string to check if block was found
            successMessage += ` Failed to save summary file ${summaryFilename}.`;
        } else { // Block wasn't found or was empty after cleaning
             successMessage += ` Pack summary block not found or was empty in output.`;
        }

        if (!res.headersSent) {
             res.status(200).json({
                success: true,
                message: successMessage,
                outputFilename: finalMainFilename // Return the main MD filename
            });
         }
    }); // End of exec callback
};
app.post('/run-repomix', handleRunRepomix);
// --- End Repomix Endpoint ---

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

// --- Basic Root Route ---
app.get('/', (req, res) => {
    res.send('Repomix Server is running.');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Repomix server listening on http://localhost:${port}`);
    console.log(`Repomix output will be saved to: ${GENERATED_FILES_DIR}`);
});