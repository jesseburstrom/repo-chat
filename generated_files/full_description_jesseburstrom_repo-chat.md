This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

<directory_structure>
backend/server.ts
backend/src/server.ts
gemini-repomix-ui/src/App.tsx
gemini-repomix-ui/src/ChatInterface.tsx
gemini-repomix-ui/src/InputArea.tsx
gemini-repomix-ui/src/main.tsx
gemini-repomix-ui/src/RepomixForm.tsx
gemini-repomix-ui/src/vite-env.d.ts
gemini-repomix-ui/vite.config.ts
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path="backend/server.ts">
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
</file>

<file path="backend/src/server.ts">
// repomix-server/src/server.ts
import express, { Request, Response, NextFunction } from 'express'; // <-- Import RequestHandler
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as fs from 'fs';
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
</file>

<file path="gemini-repomix-ui/src/App.tsx">
// gemini-repomix-ui/src/App.tsx
import { useState, useCallback } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm'; // <-- Use the form again
import './App.css';

// Define ChatMessage type locally now or in a types file
export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}
var prefix = '';
prefix = '/repochat';

const MAX_HISTORY_TURNS = 5;
// const REPOMIX_SERVER_URL = 'http://localhost:8003'; // <-- URL of the new server

function App() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // --- State for Repomix Form ---
  const [isGenerating, setIsGenerating] = useState(false); // Loading for repomix generation
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // --- End Repomix State ---

  const clearAttachedFile = useCallback(() => {
    setAttachedFileContent(null);
    setAttachedFileName(null);
    console.log("Attached file cleared.");
  }, []);

  const handleFileAttach = useCallback((file: File) => {
      setIsLoading(true); // Use the chat loading indicator briefly
      setError(null);
      setGenerationMessage(null); // Clear generation messages on manual attach
      setGenerationError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachedFileContent(content);
          setAttachedFileName(file.name);
          console.log(`Attached file ${file.name} (${(content?.length ?? 0)} chars)`);
          setIsLoading(false);
      };
      reader.onerror = (err) => {
          console.error("File reading error:", err);
          setError(`Error reading file: ${err}`);
          setAttachedFileContent(null);
          setAttachedFileName(null);
          setIsLoading(false);
      };
      reader.readAsText(file);
  }, []);


  // --- Function to call Repomix backend ---
  const handleGenerateDescription = useCallback(async (
        repoUrl: string,
        includePatterns: string,
        excludePatterns: string
    ) => {
        setIsGenerating(true);
        setGenerationMessage(null);
        setGenerationError(null);
        // Clear any manually attached file when generating a new one
        clearAttachedFile();

        //console.log(`Sending request to Repomix server: /repochat/api/run-repomix`);
        
        try {
            // *** USE RELATIVE NGINX PATH ***
            const response = await fetch(`${prefix}/api/run-repomix`, { // Correct path Nginx listens on
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repoUrl,
                    includePatterns: includePatterns || undefined, // Send undefined if empty
                    excludePatterns: excludePatterns || undefined, // Send undefined if empty
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error("Repomix server error response:", result);
                throw new Error(result.error || `HTTP error ${response.status}`);
            }

            setGenerationMessage(result.message + ` (Filename: ${result.outputFilename})`); // Display success message

        } catch (err: any) {
            console.error("Repomix generation failed:", err);
            setGenerationError(err.message || "Failed to run Repomix on server.");
        } finally {
            setIsGenerating(false);
        }
    }, [clearAttachedFile]); // Add dependency


  const handlePromptSubmit = useCallback(async (prompt: string) => {
    if (!prompt && !attachedFileContent) {
      setError("Please type a prompt or attach the generated description file.");
      return;
    }
    setIsLoading(true);
    setError(null);

    let combinedPrompt = ""; // Build the full message content for the backend
    if (attachedFileContent) {
        combinedPrompt += `Attached File Content (${attachedFileName || 'full_description.md'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
    }
    if (prompt) {
        combinedPrompt += `User Prompt: ${prompt}`;
    } else {
        combinedPrompt += `User Prompt: Please analyze the attached file content.`;
    }

    const userDisplayPrompt = prompt || `(Using attached file: ${attachedFileName})`;
    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };
    const currentHistory = [...chatHistory, newUserMessage];
    setChatHistory(currentHistory); // Optimistic UI update


      // Prepare history for the BACKEND proxy endpoint
      // Use the local ChatMessage format, the backend can handle it
      const historyForBackend: ChatMessage[] = chatHistory
        .slice(-MAX_HISTORY_TURNS * 2)
        .map(msg => ({ // Ensure it matches ChatMessage structure if needed
          role: msg.role,
          parts: msg.parts,
        }));

      console.log("Sending request to Backend Gemini Proxy");
      
      try {
          // *** CALL YOUR BACKEND PROXY ENDPOINT ***
          const response = await fetch(`${prefix}/api/call-gemini`, { // Adjust path if needed based on Nginx
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  // Send history and the combined new message
                  history: historyForBackend, // Send previous turns
                  newMessage: combinedPrompt,  // Send the full new content
              }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
              throw new Error(result.error || `API proxy error ${response.status}`);
          }

          const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text }] };
          setChatHistory(prev => [...prev, newModelMessage]);
          clearAttachedFile(); // Clear file on success

      } catch (apiError: any) {
          setError(`Error: ${apiError.message}`);
          // Rollback optimistic UI update
          setChatHistory(prev => prev.slice(0, -1));
      } finally {
          setIsLoading(false);
      }
  }, [chatHistory, attachedFileContent, attachedFileName, clearAttachedFile]);


  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Gemini Repomix Assistant</h1>
      </header>

      {/* --- Render Repomix Form --- */}
      <RepomixForm
        onGenerate={handleGenerateDescription}
        isGenerating={isGenerating}
        generationMessage={generationMessage}
        generationError={generationError}
      />
      {/* --- End Repomix Form --- */}

      <div className="chat-scroll-area">
        <ChatInterface history={chatHistory} />
        {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length-1].role === 'user' && <div className="loading-indicator">Thinking...</div>}
        {error && <div className="error-message">Error: {error}</div>}
      </div>

      <InputArea
        onPromptSubmit={handlePromptSubmit}
        onFileAttach={handleFileAttach}
        isLoading={isLoading}
        attachedFileName={attachedFileName}
      />

      <footer className="app-footer">
        {/* ... */}
      </footer>
    </div>
  );
}

export default App;

// // src/App.tsx
// import React, { useState, useEffect, useCallback } from 'react';
// import ChatInterface from './ChatInterface';
// import InputArea from './InputArea';
// import { callGeminiApi, ChatMessage } from './api';
// import { Content } from "@google/generai"; // Import Content type
// import './App.css';

// const MAX_HISTORY_TURNS = 5; // Keep last 5 User/Model pairs

// function App() {
//   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
//   const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

//   // Add a function to clear the attached file
//   const clearAttachedFile = useCallback(() => {
//     setAttachedFileContent(null);
//     setAttachedFileName(null);
//     console.log("Attached file cleared.");
//     // Optionally reset the file input if you have a ref to it and want to clear its visual state
//     // if (fileInputRef.current) { fileInputRef.current.value = ''; }
//   }, []);


//   const handleFileAttach = useCallback((file: File) => {
//     setIsLoading(true);
//     setError(null);
//     const reader = new FileReader();
//     reader.onload = (event) => {
//       const content = event.target?.result as string;
//       setAttachedFileContent(content);
//       setAttachedFileName(file.name);
//       setIsLoading(false);
//       console.log(`Attached file ${file.name} (${(content?.length ?? 0)} chars)`);
//     };
//     reader.onerror = (err) => {
//       console.error("File reading error:", err);
//       setError(`Error reading file: ${err}`);
//       setAttachedFileContent(null);
//       setAttachedFileName(null);
//       setIsLoading(false);
//     };
//     reader.readAsText(file);
//   }, []);

//   const handlePromptSubmit = useCallback(async (prompt: string) => {
//     if (!prompt && !attachedFileContent) { // Need either a prompt or a file to proceed
//         setError("Please type a prompt or attach a file.");
//         return;
//     }

//     setIsLoading(true);
//     setError(null);

//     // IMPORTANT: Create the message text *before* adding to local history
//     // This ensures the API gets the combined content, but UI shows only user prompt
//     let messageToSendToApi = "";

//     if (attachedFileContent) {
//       // Clearly delineate the attached file content for the model
//       messageToSendToApi += `Attached File Content (${attachedFileName || 'context.txt'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
//     }
//     // Add the user's typed prompt after the file content
//      if (prompt) {
//         messageToSendToApi += `User Prompt: ${prompt}`;
//      } else {
//          // If no prompt but file is attached, give a default instruction
//          messageToSendToApi += `User Prompt: Please analyze the attached file content.`;
//      }


//     // Add ONLY the user's typed prompt (or a placeholder if none) to the visual chat history
//      const userDisplayPrompt = prompt || `(Analyzing attached file: ${attachedFileName})`;
//     const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };
//     const currentHistory = [...chatHistory, newUserMessage];
//     setChatHistory(currentHistory); // Show user message immediately

//     // Prepare history for Gemini API (needs Content[] format)
//     // Exclude the message we just added visually
//     const historyForApi: Content[] = chatHistory
//       .slice(-MAX_HISTORY_TURNS * 2) // Limit history turns sent
//       .map(msg => ({
//         role: msg.role,
//         parts: msg.parts,
//       }));

//     console.log("History being sent to API:", historyForApi);
//     console.log("Message being sent to API:", messageToSendToApi);


//     try {
//       // Send the history (previous turns) and the NEW combined message
//       const responseText = await callGeminiApi(historyForApi, messageToSendToApi);
//       const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
//       setChatHistory(prev => [...prev, newModelMessage]); // Add model response

//       // --- Clear the file after successful use ---
//       // Decide if you want to clear the file after each prompt.
//       // If you want it to persist, comment out the next line.
//        clearAttachedFile();
//       // ---
//     } catch (apiError: any) {
//       setError(`API Error: ${apiError.message}`);
//       // Rollback the optimistic UI update for the user message
//       setChatHistory(prev => prev.slice(0, -1));
//     } finally {
//       setIsLoading(false);
//     }
//   }, [chatHistory, attachedFileContent, attachedFileName, clearAttachedFile]); // Add clearAttachedFile dependency

//   return (
//     <div className="app-container">
//       <header className="app-header">
//         <h1>Gemini Repomix Assistant</h1>
//       </header>

//       <div className="chat-scroll-area">
//         <ChatInterface history={chatHistory} />
//         {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length-1].role === 'user' && <div className="loading-indicator">Thinking...</div>} {/* Show loading after user msg */}
//         {error && <div className="error-message">Error: {error}</div>}
//       </div>

//       <InputArea
//         onPromptSubmit={handlePromptSubmit}
//         onFileAttach={handleFileAttach}
//         isLoading={isLoading}
//         attachedFileName={attachedFileName}
//         // Pass the clear function to InputArea if you add a remove button there
//         // onFileRemove={clearAttachedFile}
//       />

//       <footer className="app-footer">
//          {/* Maybe add token count here later */}
//       </footer>
//     </div>
//   );
// }

// export default App;
</file>

<file path="gemini-repomix-ui/src/ChatInterface.tsx">
// src/ChatInterface.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHighlighter, bundledLanguages } from 'shikiji'; // Import from shikiji
import type { Highlighter } from 'shikiji'; // Import type

import { ChatMessage } from './App';
import './ChatInterface.css'; // Keep your existing CSS for overall layout

// --- Shikiji Highlighter Setup ---
// Use state to hold the highlighter instance as it's async
const useShikijiHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initHighlighter() {
      try {
        const hl = await getHighlighter({
          themes: ['material-theme-lighter'], // Choose theme(s) - 'material-theme-lighter' is close to materialLight
          langs: Object.keys(bundledLanguages), // Load all bundled languages or specify needed ones
        });
        if (isMounted) {
          setHighlighter(hl);
        }
      } catch (error) {
        console.error("Failed to initialize Shikiji:", error);
         if (isMounted) {
             // Handle error, maybe disable highlighting
         }
      }
    }
    initHighlighter();
    return () => { isMounted = false; }; // Cleanup on unmount
  }, []); // Run only once on mount

  return highlighter;
};
// --- End Shikiji Setup ---


interface ChatInterfaceProps {
  history: ChatMessage[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history }) => {
   const highlighter = useShikijiHighlighter(); // Get the highlighter instance

  // Custom renderer using Shikiji
  const CodeBlockRenderer = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'plaintext'; // Default to plaintext if no language
    const codeString = String(children).replace(/\n$/, '');

    // Don't highlight inline code blocks with the full highlighter
    if (inline) {
        return <code className="inline-code" {...props}>{children}</code>;
    }

    // If highlighter isn't ready yet, render plain code block
    if (!highlighter) {
        return <pre className={`language-${lang}`}><code className={`language-${lang}`} {...props}>{children}</code></pre>;
    }

    try {
        // Generate HTML with Shikiji
        const html = highlighter.codeToHtml(codeString, {
            lang: lang,
            theme: 'material-theme-lighter', // Use the theme loaded earlier
        });
        // Use dangerouslySetInnerHTML to render the generated HTML
        // Note: This is generally safe here as Shikiji outputs controlled HTML
        return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;

    } catch (error) {
         console.warn(`Shikiji highlighting failed for language "${lang}":`, error);
         // Fallback to plain pre/code block on error
         return <pre className={`language-${lang}`}><code className={`language-${lang}`} {...props}>{children}</code></pre>;
    }
  };


  return (
    <div className="chat-interface">
      {history.map((message, index) => (
        <div key={index} className={`chat-message ${message.role}`}>
          <span className="message-role">{message.role === 'user' ? 'You' : 'Model'}</span>
          <div className="message-content">
            {message.role === 'model' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlockRenderer, // Use Shikiji renderer
                }}
              >
                {message.parts[0].text}
              </ReactMarkdown>
            ) : (
              message.parts[0].text.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  <br />
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatInterface;
</file>

<file path="gemini-repomix-ui/src/InputArea.tsx">
// src/InputArea.tsx
import React, { useState, useRef } from 'react';
import './InputArea.css'; // We'll create this CSS file

interface InputAreaProps {
  onPromptSubmit: (prompt: string) => void;
  onFileAttach: (file: File) => void;
  isLoading: boolean;
  attachedFileName: string | null;
}

const InputArea: React.FC<InputAreaProps> = ({
  onPromptSubmit,
  onFileAttach,
  isLoading,
  attachedFileName,
}) => {
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (prompt.trim() && !isLoading) {
      onPromptSubmit(prompt);
      setPrompt(''); // Clear input after submit
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault(); // Prevent newline on Enter
      handleSubmit(event as any); // Submit form
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileAttach(file);
       // Reset file input to allow attaching the same file again if needed
       event.target.value = '';
    }
  };

  return (
    <div className="input-area-container">
      <form onSubmit={handleSubmit} className="input-form">
         <button
            type="button"
            onClick={handleFileButtonClick}
            disabled={isLoading}
            className="attach-button"
            title="Attach Repomix Output File"
        >
            📎 {/* Use an icon font or SVG for better results */}
        </button>
        <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".txt,.md" // Accept text and markdown files
        />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type something..."
          className="prompt-input"
          rows={1} // Start with one row, auto-expand with CSS
          disabled={isLoading}
        />
         <button type="submit" disabled={isLoading || !prompt.trim()} className="submit-button">
             {isLoading ? 'Thinking...' : 'Run'} <span className="shortcut">(Ctrl+↵)</span>
         </button>
      </form>
      {attachedFileName && <div className="attached-file-indicator">Attached: {attachedFileName}</div>}
    </div>
  );
};

export default InputArea;
</file>

<file path="gemini-repomix-ui/src/main.tsx">
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
</file>

<file path="gemini-repomix-ui/src/RepomixForm.tsx">
// src/RepomixForm.tsx
import React, { useState } from 'react';
import './RepomixForm.css'; // We'll create this CSS file

interface RepomixFormProps {
    onGenerate: (repoUrl: string, includePatterns: string, excludePatterns: string) => void;
    isGenerating: boolean;
    generationMessage: string | null;
    generationError: string | null;
}

const RepomixForm: React.FC<RepomixFormProps> = ({
    onGenerate,
    isGenerating,
    generationMessage,
    generationError,
}) => {
    const [repoUrl, setRepoUrl] = useState('');
    // Default values similar to your python example
    const [includePatterns, setIncludePatterns] = useState('lib/**/*.dart,backend/**/*.ts,unity/**/*.cs');
    const [excludePatterns, setExcludePatterns] = useState('*.log,tmp/'); // repomix uses --ignore

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (repoUrl && !isGenerating) {
            onGenerate(repoUrl, includePatterns, excludePatterns);
        }
    };

    return (
        <div className="repomix-form-container">
            <h3>Generate Project Description</h3>
            <form onSubmit={handleSubmit} className="repomix-form">
                <div className="form-group">
                    <label htmlFor="repoUrl">GitHub Repo URL:</label>
                    <input
                        type="url"
                        id="repoUrl"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        required
                        disabled={isGenerating}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="includePatterns">Include Patterns (comma-separated):</label>
                    <input
                        type="text"
                        id="includePatterns"
                        value={includePatterns}
                        onChange={(e) => setIncludePatterns(e.target.value)}
                        placeholder="src/**/*.js,*.css"
                        disabled={isGenerating}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="excludePatterns">Exclude Patterns (comma-separated):</label>
                    <input
                        type="text"
                        id="excludePatterns"
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        placeholder="*.log,dist/"
                        disabled={isGenerating}
                    />
                </div>
                <button type="submit" disabled={isGenerating || !repoUrl}>
                    {isGenerating ? 'Generating...' : 'Generate Description File'}
                </button>
            </form>
            {generationMessage && <p className="generation-status success">{generationMessage}</p>}
            {generationError && <p className="generation-status error">Error: {generationError}</p>}
        </div>
    );
};

export default RepomixForm;
</file>

<file path="gemini-repomix-ui/src/vite-env.d.ts">
/// <reference types="vite/client" />
</file>

<file path="gemini-repomix-ui/vite.config.ts">
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/repochat/',
  server: { // Add server configuration
    proxy: {
      // Proxy requests starting with /api (or choose another prefix)
      // to your backend server running on port 8003
      '/api': { // You can choose any prefix, e.g., '/backend-api'
        target: 'http://localhost:8003', // Target your backend server
        changeOrigin: true, // Recommended for virtual hosted sites
        // Optional: rewrite path if needed (but usually not if backend uses the same path)
        rewrite: (path) => path.replace(/^\/api/, ''), // Remove /api prefix if backend doesn't expect it
      }
    }
  }
})
</file>

</files>
