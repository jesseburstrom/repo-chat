// gemini-repomix-ui/src/App.tsx
import { useState, useCallback } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm'; // <-- Use the form again
import { callGeminiApi, ChatMessage } from './api';
import { Content } from "@google/generative-ai";
import './App.css';

const MAX_HISTORY_TURNS = 5;
const REPOMIX_SERVER_URL = 'http://localhost:8003'; // <-- URL of the new server

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

        console.log(`Sending request to Repomix server: ${REPOMIX_SERVER_URL}/run-repomix`);

        try {
            // *** POINT TO THE NEW SERVER ***
            const response = await fetch(`${REPOMIX_SERVER_URL}/run-repomix`, {
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
      // ... (Keep the prompt submission logic exactly as it was in the previous step) ...
       if (!prompt && !attachedFileContent) {
          setError("Please type a prompt or attach the generated description file.");
          return;
      }
      setIsLoading(true);
      setError(null);

      let messageToSendToApi = "";
      if (attachedFileContent) {
          messageToSendToApi += `Attached File Content (${attachedFileName || 'full_description.md'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
      }
       if (prompt) {
          messageToSendToApi += `User Prompt: ${prompt}`;
       } else {
           messageToSendToApi += `User Prompt: Please analyze the attached file content.`;
       }

      const userDisplayPrompt = prompt || `(Using attached file: ${attachedFileName})`;
      const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };
      const currentHistory = [...chatHistory, newUserMessage];
      setChatHistory(currentHistory);

      const historyForApi: Content[] = chatHistory
        .slice(-MAX_HISTORY_TURNS * 2)
        .map(msg => ({ role: msg.role, parts: msg.parts }));

      console.log("History being sent to API:", historyForApi);
      console.log("Message being sent to API:", messageToSendToApi);

      try {
          const responseText = await callGeminiApi(historyForApi, messageToSendToApi);
          const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
          setChatHistory(prev => [...prev, newModelMessage]);
          // Optionally clear file after use:
          // clearAttachedFile();
      } catch (apiError: any) {
          setError(`API Error: ${apiError.message}`);
          setChatHistory(prev => prev.slice(0, -1));
      } finally {
          setIsLoading(false);
          // Clear file ONLY if successful and you want single-use
           if (!error) {
               clearAttachedFile(); // Example: clear on success
           }
      }
  }, [chatHistory, attachedFileContent, attachedFileName, clearAttachedFile, error]);


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