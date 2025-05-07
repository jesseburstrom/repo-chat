// repomix-server/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as fs from 'fs';
import { constants as fsConstants } from 'fs';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

// MODIFICATION: Import StartChatParams if you plan to use systemInstruction there, otherwise it's not strictly needed if set in getGenerativeModel
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content, FinishReason, SafetyRating, StartChatParams } from "@google/generative-ai";

// --- NEW: Import model definitions and helpers ---
import { GEMINI_MODELS, DEFAULT_MODEL_CALL_NAME, calculateCost, GeminiModelInfo } from './geminiModels'; // Create this file as previously described

const geminiApiKey: string = process.env.GEMINI_API_KEY as string;
if (!geminiApiKey) {
  console.error("FATAL: GEMINI_API_KEY not found in server environment variables.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const generationConfig: GenerationConfig = { /* ... your config ... */ }; // Keep your existing config
// const safetySettings = [ /* ... your settings ... */ ]; // Define if needed globally

// MODIFICATION: The global `model` instance will be less used if we select models dynamically.
// It can serve as a fallback or for non-chat specific tasks if any.
// For chat, we will get the model instance dynamically in `handleCallGemini`.
/*
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-05-25", // This will be overridden by dynamic selection
    // safetySettings,
    generationConfig,
});
*/

const app = express();
const port = 8003;

const corsOptions = {
    origin: ['http://localhost:5173', 'https://fluttersystems.com'],
    methods: ['GET', 'POST', 'OPTIONS'], // MODIFICATION: Added GET for new config endpoint
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const GENERATED_FILES_DIR = path.resolve(__dirname, '..', '..', 'generated_files');
const TEMP_FILENAME_PREFIX = 'temp_repomix_output';
const MAIN_FILENAME_EXTENSION = '.md';
const SUMMARY_FILENAME_EXTENSION = '.txt';
const SUMMARY_FILENAME_SUFFIX = '_pack_summary';

// Your existing system prompt file logic
const SYSTEM_PROMPT_FILENAME = 'system_prompt.txt'; // This might be different from Gemini's "systemInstruction"
const SYSTEM_PROMPT_FULL_PATH = path.join(GENERATED_FILES_DIR, SYSTEM_PROMPT_FILENAME);

// --- NEW: Config file for last selected model ---
const GEMINI_CONFIG_PATH = path.resolve(__dirname, '..', 'gemini_config.json'); // Store it alongside server.ts or in a config dir
let currentSelectedModelCallName = DEFAULT_MODEL_CALL_NAME;

function loadLastSelectedModel() {
    try {
        if (fs.existsSync(GEMINI_CONFIG_PATH)) {
            const configData = fs.readFileSync(GEMINI_CONFIG_PATH, 'utf-8');
            const config = JSON.parse(configData);
            if (config.lastSelectedModel && GEMINI_MODELS.some(m => m.callName === config.lastSelectedModel)) {
                currentSelectedModelCallName = config.lastSelectedModel;
                console.log(`Loaded last selected model: ${currentSelectedModelCallName}`);
            } else {
                console.log(`Last selected model in config not valid or not found, using default: ${DEFAULT_MODEL_CALL_NAME}`);
                saveLastSelectedModel(DEFAULT_MODEL_CALL_NAME); // Save default if invalid
            }
        } else {
            console.log(`Gemini config file not found, creating with default model: ${DEFAULT_MODEL_CALL_NAME}`);
            saveLastSelectedModel(DEFAULT_MODEL_CALL_NAME);
        }
    } catch (error) {
        console.error("Error loading Gemini config, using default:", error);
        currentSelectedModelCallName = DEFAULT_MODEL_CALL_NAME;
    }
}

function saveLastSelectedModel(modelCallName: string) {
    try {
        const config = { lastSelectedModel: modelCallName };
        fs.writeFileSync(GEMINI_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        currentSelectedModelCallName = modelCallName; // Update in-memory state
        console.log(`Saved last selected model: ${modelCallName}`);
    } catch (error) {
        console.error("Error saving Gemini config:", error);
    }
}

loadLastSelectedModel(); // Load on server start
// --- END NEW: Config file logic ---


// Interface for the save system prompt request body (your existing one)
interface SaveSystemPromptBody {
    systemPrompt: string;
}

// --- Helper Function generateSafeRepoPartsFromUrl (Unchanged from your original) ---
function generateSafeRepoPartsFromUrl(repoUrl: string): { success: boolean; safeUser?: string; safeRepo?: string; error?: string } {
    // ... your existing implementation ...
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

// --- Ensure output directory exists (Unchanged from your original) ---
if (!fs.existsSync(GENERATED_FILES_DIR)) {
  console.log(`Creating directory for generated files: ${GENERATED_FILES_DIR}`);
  try {
    fs.mkdirSync(GENERATED_FILES_DIR, { recursive: true });
  } catch (err) {
     console.error("FATAL: Could not create generated_files directory.", err);
     process.exit(1);
  }
}
// --- End Directory Setup ---

// --- Endpoint: /list-generated-files (Unchanged from your original) ---
app.get('/list-generated-files', async (req: Request, res: Response, next: NextFunction) => {
    // ... your existing implementation ...
    console.log(`Request received for /list-generated-files`);
    try {
        const files = await fs.promises.readdir(GENERATED_FILES_DIR);
        const repoFiles = files
            .map(filename => {
                const isSummaryFile = filename.endsWith(`${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`);
                const isMainFile = filename.endsWith(MAIN_FILENAME_EXTENSION);
                if (isMainFile && !isSummaryFile) {
                    const baseName = filename.slice(0, -MAIN_FILENAME_EXTENSION.length);
                     const parts = baseName.split('_');
                     if (parts.length >= 2) {
                        const user = parts.slice(0, -1).join('_');
                        const repo = parts[parts.length - 1];
                        const repoIdentifier = `${user}/${repo}`;
                        return { filename, repoIdentifier };
                     }
                }
                return null;
            })
            .filter(item => item !== null)
            .sort((a, b) => (a!.repoIdentifier).localeCompare(b!.repoIdentifier));
        console.log(`Found ${repoFiles.length} main repo files.`);
        res.status(200).json({ success: true, data: repoFiles });
    } catch (error: any) {
        console.error("Error listing generated files:", error);
        if (error.code === 'ENOENT') {
            res.status(200).json({ success: true, data: [] });
        } else {
            next(error);
        }
    }
});
// --- End List Endpoint ---

// --- Endpoint: /get-file-content (Unchanged from your original, minor path check adjustment might be needed if system_prompt.txt needs to be fetched this way) ---
const handleGetFileContent = async (req: Request<{ filename: string }>, res: Response, next: NextFunction): Promise<void> => {
    const requestedFilename = req.params.filename;
    console.log(`Request received for /get-file-content/${requestedFilename}`);

    // MODIFICATION: Allow system_prompt.txt to be fetched if that's intended by client via this endpoint
    const isSystemPromptFile = requestedFilename === SYSTEM_PROMPT_FILENAME;
    const safeFilenameRegex = /^[a-zA-Z0-9_.-]+(\.md|_pack_summary\.txt)$/; // Original regex
    const resolvedPath = path.join(GENERATED_FILES_DIR, requestedFilename);
    const normalizedPath = path.normalize(resolvedPath);

    if (!requestedFilename || requestedFilename.includes('/') || requestedFilename.includes('..')) {
         res.status(400).json({ success: false, error: 'Invalid filename format.' });
         return;
    }
    // Allow system prompt file or files matching the regex
    if (!isSystemPromptFile && !safeFilenameRegex.test(requestedFilename)) {
        console.warn(`Filename does not match expected pattern: ${requestedFilename}`);
        // Consider if this should be an error or if system_prompt.txt is handled by a different endpoint
        // For now, let's assume system_prompt.txt is fetched by its dedicated /load-system-prompt
    }
    if (!normalizedPath.startsWith(GENERATED_FILES_DIR)) {
        console.error(`Path traversal attempt detected: ${requestedFilename} resolved to ${normalizedPath}`);
        res.status(400).json({ success: false, error: 'Invalid filename.' });
        return;
    }
    try {
        await fs.promises.access(normalizedPath, fsConstants.R_OK);
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');
        res.status(200).json({ success: true, content: content });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ success: false, error: 'File not found.' });
        } else if (error.code === 'EACCES') {
             res.status(500).json({ success: false, error: 'Could not read file (permission issue).' });
        }
        else {
            next(error);
        }
    }
};
app.get('/get-file-content/:filename', handleGetFileContent);
// --- End Get Content Endpoint ---

// --- Request Body Interface for Repomix (Unchanged from your original) ---
interface RunRepomixRequestBody {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}

// --- Repomix Endpoint (Unchanged from your original) ---
const handleRunRepomix = (req: Request<{}, {}, RunRepomixRequestBody>, res: Response, next: NextFunction): void => {
    // ... your existing implementation ...
    const { repoUrl, includePatterns, excludePatterns } = req.body;
    if (!repoUrl) {
        res.status(400).json({ success: false, error: 'repoUrl is required' });
        return;
    }
    const repoPartsResult = generateSafeRepoPartsFromUrl(repoUrl);
    if (!repoPartsResult.success || !repoPartsResult.safeUser || !repoPartsResult.safeRepo) {
        res.status(400).json({ success: false, error: repoPartsResult.error || 'Failed to generate filename parts from URL.' });
        return;
    }
    const { safeUser, safeRepo } = repoPartsResult;
    const mainBaseFilename = `${safeUser}_${safeRepo}`;
    const finalMainFilename = `${mainBaseFilename}${MAIN_FILENAME_EXTENSION}`;
    const summaryFilename = `${mainBaseFilename}${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`;
    const tempOutputFilename = `${TEMP_FILENAME_PREFIX}_${mainBaseFilename}_${Date.now()}${MAIN_FILENAME_EXTENSION}`;
    const tempFullOutputPath = path.join(GENERATED_FILES_DIR, tempOutputFilename);
    const finalMainFullOutputPath = path.join(GENERATED_FILES_DIR, finalMainFilename);
    const summaryFullOutputPath = path.join(GENERATED_FILES_DIR, summaryFilename);
    const repomixExecutable = "npx repomix";
    let command = `${repomixExecutable} --remote "${repoUrl}" --output "${tempFullOutputPath}" --style xml`;
    if (includePatterns) command += ` --include "${includePatterns}"`;
    if (excludePatterns) command += ` --ignore "${excludePatterns}"`;
    if (fs.existsSync(tempFullOutputPath)) {
        try { fs.unlinkSync(tempFullOutputPath); } catch (e) { /* ignore */ }
    }
    exec(command, { timeout: 300000, maxBuffer: 1024 * 1024 * 5 }, async (error, stdout, stderr) => {
        if (error) {
             if (fs.existsSync(tempFullOutputPath)) {
                  try { fs.unlinkSync(tempFullOutputPath); } catch (e) { /* ignore */ }
             }
             if (!res.headersSent) {
                  res.status(500).json({ success: false, error: `Repomix execution failed: ${error.message}`, stderr: stderr, stdout: stdout });
             }
            return;
        }
        if (stderr) console.warn(`Repomix stderr output:\n${stderr}`);
        if (!fs.existsSync(tempFullOutputPath)) {
             if (!res.headersSent) {
                  res.status(500).json({ success: false, error: 'Repomix finished, but the temporary output file was not created.', stdout: stdout, stderr: stderr });
              }
            return;
        }
        let summarySaved = false;
        let cleanedSummaryString = '';
        try {
            const lines = stdout.split('\n');
            let summaryStartIndex = -1;
            let summaryEndIndex = -1;
            const startMarker = 'pack summary';
            const endMarker = '🎉 all done!';
            for (let i = 0; i < lines.length; i++) {
                const lineLower = lines[i].toLowerCase();
                if (summaryStartIndex === -1 && lineLower.includes(startMarker)) summaryStartIndex = i;
                if (summaryStartIndex !== -1 && lineLower.includes(endMarker) && i > summaryStartIndex) {
                    summaryEndIndex = i;
                    break;
                }
            }
            if (summaryStartIndex !== -1) {
                const extractedSummaryString = lines.slice(summaryStartIndex, summaryEndIndex === -1 ? lines.length : summaryEndIndex).join('\n').trim();
                const ansiRegex = /\u001b\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGKHF]/g;
                cleanedSummaryString = extractedSummaryString.replace(ansiRegex, '');
            }
            if (cleanedSummaryString) {
                try {
                    if (fs.existsSync(summaryFullOutputPath)) { /* Overwrite */ }
                    await fs.promises.writeFile(summaryFullOutputPath, cleanedSummaryString, 'utf-8');
                    summarySaved = true;
                } catch (writeErr: any) { /* ignore */ }
            }
             if (fs.existsSync(finalMainFullOutputPath)) {
                 try { await fs.promises.unlink(finalMainFullOutputPath); } catch (unlinkErr: any) { /* ignore */ }
             }
            await fs.promises.rename(tempFullOutputPath, finalMainFullOutputPath);
        } catch (processingError: any) {
             if (fs.existsSync(tempFullOutputPath)) {
                 try { await fs.promises.unlink(tempFullOutputPath); } catch (e) { /* ignore */ }
             }
            if (!res.headersSent) {
                 res.status(500).json({ success: false, error: `Failed during file processing: ${processingError.message}` });
            }
            return;
        }
        let successMessage = `Repomix completed. Main output saved as ${finalMainFilename}.`;
        if (summarySaved) successMessage += ` Cleaned summary saved as ${summaryFilename}.`;
        else if (cleanedSummaryString) successMessage += ` Failed to save summary.`;
        else successMessage += ` Pack summary block not found.`;

        if (!res.headersSent) {
             res.status(200).json({ success: true, message: successMessage, outputFilename: finalMainFilename });
         }
    });
};
app.post('/run-repomix', handleRunRepomix);
// --- End Repomix Endpoint ---


// --- NEW Endpoint: /gemini-config ---
app.get('/gemini-config', (req: Request, res: Response) => {
    const clientSafeModels = GEMINI_MODELS.map(m => ({
        displayName: m.displayName,
        callName: m.callName,
        capabilities: m.capabilities,
        notes: m.notes,
    }));
    res.status(200).json({
        success: true,
        models: clientSafeModels,
        currentModelCallName: currentSelectedModelCallName,
    });
});
// --- END NEW Endpoint ---


// MODIFICATION: Updated CallGeminiRequestBody and response type
interface CallGeminiRequestBody {
    history: Content[];
    newMessage: string;
    systemPrompt?: string; // This is your existing systemPrompt field
    modelCallName?: string; // NEW: For selecting the Gemini model
}

interface GeminiApiResponse { // NEW: More detailed response
    success: boolean;
    text?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}

const handleCallGemini = async (
    req: Request<{}, {}, CallGeminiRequestBody>,
    res: Response<GeminiApiResponse>, // MODIFICATION: Use detailed response type
    next: NextFunction
): Promise<void> => {
    // MODIFICATION: Destructure modelCallName
    const { history, newMessage, systemPrompt, modelCallName: requestedModelCallName } = req.body;

    if (!newMessage) {
        res.status(400).json({ success: false, error: 'newMessage is required.' });
        return;
    }
    if (!Array.isArray(history)) {
         res.status(400).json({ success: false, error: 'history must be an array.' });
         return;
    }

    // MODIFICATION: Determine which model to use
    const modelToUse = requestedModelCallName && GEMINI_MODELS.some(m => m.callName === requestedModelCallName)
        ? requestedModelCallName
        : currentSelectedModelCallName;

    console.log(`Received Gemini request. Model: ${modelToUse}, History length: ${history.length}`);
    let effectiveSystemInstruction = systemPrompt; // Use the systemPrompt from request body as the Gemini systemInstruction

    // Optional: If you want to *always* load system_prompt.txt and use it if no systemPrompt is in the request body
    if (!effectiveSystemInstruction && fs.existsSync(SYSTEM_PROMPT_FULL_PATH)) {
        try {
            effectiveSystemInstruction = await fs.promises.readFile(SYSTEM_PROMPT_FULL_PATH, 'utf-8');
            console.log("Loaded system instruction from file for Gemini API call.");
        } catch (err) {
            console.warn("Could not load system_prompt.txt for Gemini API call, proceeding without it.", err);
        }
    }

    if (effectiveSystemInstruction) {
        console.log("Effective System Instruction for Gemini API. Length:", effectiveSystemInstruction.length);
    }
    console.log("New message:", newMessage.substring(0, 50) + "...");


    try {
        // MODIFICATION: Get model instance dynamically
        const modelOptions: {
            model: string;
            generationConfig: GenerationConfig;
            systemInstruction?: string | Content;
            // safetySettings?: SafetySetting[]; // If you have global safety settings
        } = {
            model: modelToUse,
            generationConfig,
            // safetySettings, // Add if defined
        };

        if (effectiveSystemInstruction && effectiveSystemInstruction.trim().length > 0) {
            modelOptions.systemInstruction = effectiveSystemInstruction;
        }
        
        const dynamicModel = genAI.getGenerativeModel(modelOptions); // Get the specific model instance

        // Your original StartChatParams logic - adapt if systemInstruction is now part of modelOptions
        const startChatParams: StartChatParams = { history };
        // If systemInstruction is handled by getGenerativeModel, you might not need it in startChatParams
        // UNLESS you want to override it per session, which seems less likely here.
        // For clarity, if modelOptions.systemInstruction is set, it will be used.
        // If you also set it here, the one in startChat might take precedence for that session.
        // Let's rely on it being set in getGenerativeModel for consistency.

        const chatSession = dynamicModel.startChat(startChatParams); // Use dynamicModel
        const result = await chatSession.sendMessage(newMessage);
        const response = result.response;

        if (response.promptFeedback?.blockReason) {
            const reason = response.promptFeedback.blockReason;
            res.status(400).json({ success: false, error: `Prompt blocked by safety filter: ${reason}` });
            return;
        }
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
            res.status(500).json({ success: false, error: 'Gemini API returned no response candidates.' });
            return;
        }
        const firstCandidate = candidates[0];
        if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
            res.status(400).json({ success: false, error: `Response stopped due to ${firstCandidate.finishReason}` });
            return;
        }
        if (!firstCandidate.content?.parts || firstCandidate.content.parts.length === 0 || !firstCandidate.content.parts.some(p => p.text)) {
            res.status(500).json({ success: false, error: 'Gemini API returned no text content.' });
            return;
        }

        const responseText = response.text();

        // --- NEW: Token counting and cost calculation ---
        let inputTokens = 0;
        let outputTokens = 0;
        if (response.usageMetadata) {
            inputTokens = response.usageMetadata.promptTokenCount || 0;
            outputTokens = response.usageMetadata.candidatesTokenCount || 0;
            console.log(`Tokens - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${response.usageMetadata.totalTokenCount}`);
        } else {
            // Fallback manual count (less accurate)
            try {
                // For more accurate manual count with system instructions, you'd need to construct the full prompt
                const promptTokenCountResult = await dynamicModel.countTokens(newMessage); // Or construct full prompt content
                inputTokens = promptTokenCountResult.totalTokens;
                const responseTokenCountResult = await dynamicModel.countTokens(responseText);
                outputTokens = responseTokenCountResult.totalTokens;
                console.warn(`Used manual token counting for ${modelToUse}. Input: ${inputTokens}, Output: ${outputTokens}. This might be less accurate.`);
            } catch (countError) {
                console.error("Error counting tokens manually:", countError);
            }
        }
        
        const { inputCost, outputCost, totalCost } = calculateCost(modelToUse, inputTokens, outputTokens);
        console.log(`Cost for ${modelToUse} - Input: $${inputCost.toFixed(6)}, Output: $${outputCost.toFixed(6)}, Total: $${totalCost.toFixed(6)}`);

        // Save the successfully used model as the last selected
        if (modelToUse !== currentSelectedModelCallName) {
            saveLastSelectedModel(modelToUse);
        } else if (requestedModelCallName && requestedModelCallName === modelToUse && !fs.existsSync(GEMINI_CONFIG_PATH)) {
            // Edge case: config deleted, then specific model used
            saveLastSelectedModel(modelToUse);
        }
        // --- END NEW: Token counting ---

        // MODIFICATION: Send back detailed response
        res.status(200).json({
            success: true,
            text: responseText,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            inputCost,
            outputCost,
            totalCost,
            modelUsed: modelToUse,
        });

    } catch (error: any) {
        console.error(`Error calling Gemini API on server with model ${modelToUse}:`, error);
        next(error);
    }
};
app.post('/call-gemini', handleCallGemini); // Ensure this uses the modified handler


// --- Endpoint: /load-system-prompt (Your existing endpoint, unchanged) ---
app.get('/load-system-prompt', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log(`Request received for /load-system-prompt`);
    try {
        if (fs.existsSync(SYSTEM_PROMPT_FULL_PATH)) {
            const promptContent = await fs.promises.readFile(SYSTEM_PROMPT_FULL_PATH, 'utf-8');
            console.log(`System prompt loaded from file. Length: ${promptContent.length}`);
            res.status(200).json({ success: true, systemPrompt: promptContent });
        } else {
            console.log(`System prompt file not found, returning empty.`);
            res.status(200).json({ success: true, systemPrompt: '' });
        }
    } catch (error: any) {
        console.error("Error loading system prompt from file:", error);
        res.status(500).json({ success: false, error: "Could not load system prompt from file." });
    }
});

// --- Endpoint: /save-system-prompt (Your existing endpoint, unchanged) ---
app.post('/save-system-prompt', async (
    req: Request<{}, {}, SaveSystemPromptBody>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { systemPrompt } = req.body;
    console.log(`Request received for /save-system-prompt (file). Length: ${systemPrompt?.length}`);

    if (typeof systemPrompt !== 'string') {
        res.status(400).json({ success: false, error: 'systemPrompt (string) is required in the body.' });
        return;
    }
    try {
        await fs.promises.writeFile(SYSTEM_PROMPT_FULL_PATH, systemPrompt, 'utf-8');
        console.log(`System prompt saved to file: ${SYSTEM_PROMPT_FULL_PATH}`);
        res.status(200).json({ success: true, message: 'System prompt saved to file.' });
    } catch (error: any) {
        console.error("Error saving system prompt to file:", error);
        res.status(500).json({ success: false, error: 'Could not save system prompt to file.' });
    }
});
// --- End Gemini Proxy Endpoint (This comment might be misplaced from your original, /call-gemini is the main one) ---

// --- Basic Root Route (Unchanged from your original) ---
app.get('/', (req, res) => {
    res.send('Repomix Server is running.');
});

// --- Start Server (Unchanged from your original, added log for selected model) ---
app.listen(port, () => {
    console.log(`Repomix server listening on http://localhost:${port}`);
    console.log(`Repomix output will be saved to: ${GENERATED_FILES_DIR}`);
    if (currentSelectedModelCallName) { // NEW: Log current model
        console.log(`Default/Last selected Gemini model: ${currentSelectedModelCallName}`);
    }
});

// ADDITION: Global error handler (good practice)
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