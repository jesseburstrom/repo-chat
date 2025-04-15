// gemini-repomix-ui/src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm'; // <-- Use the form again
import RepoSelector, { RepoInfo } from './RepoSelector'; 
import './App.css';

// Define ChatMessage type locally now or in a types file
export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}
var prefix = '';
//prefix = '/repochat';

const MAX_HISTORY_TURNS = 5;

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

   // --- Repo Selector State ---
   const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
   const [isLoadingRepos, setIsLoadingRepos] = useState(false);
   const [repoListError, setRepoListError] = useState<string | null>(null);
   const [selectedRepoFile, setSelectedRepoFile] = useState<string>(""); // Control dropdown value
   const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
   // --- End Repo Selector State ---

   // Ref for the scrollable div
  const scrollableAreaRef = useRef<HTMLDivElement>(null);
  
   // --- Fetch Available Repos on Mount ---
  const fetchAvailableRepos = useCallback(async () => {
    setIsLoadingRepos(true);
    setRepoListError(null);
    console.log("Fetching available repo files...");
    try {
        const response = await fetch(`${prefix}/api/list-generated-files`); // Use Nginx path
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || `HTTP error ${response.status}`);
        }
        console.log("Available repos fetched:", result.data);
        setAvailableRepos(result.data || []);
    } catch (err: any) {
        console.error("Failed to fetch repo list:", err);
        setRepoListError(err.message || "Could not load repo list.");
        setAvailableRepos([]); // Clear list on error
    } finally {
        setIsLoadingRepos(false);
    }
}, []);

useEffect(() => {
    fetchAvailableRepos(); // Fetch on initial load
}, [fetchAvailableRepos]);
// --- End Fetch Repos ---

const clearAttachedFile = useCallback(() => {
  setAttachedFileContent(null);
  setAttachedFileName(null);
  console.log("Attached file cleared.");
}, []);


// --- Load Content for Selected Repo ---
const loadRepoFileContent = useCallback(async (filename: string) => {
    if (!filename) { // Handle "-- Select --" option
        clearAttachedFile();
        setSelectedRepoFile("");
        return;
    }
    setIsLoadingFileContent(true);
    setError(null); // Clear chat errors
    setRepoListError(null); // Clear repo errors
    clearAttachedFile(); // Clear any manually attached file first
    setSelectedRepoFile(filename); // Update dropdown state
    console.log(`Loading content for: ${filename}`);

    try {
        const response = await fetch(`${prefix}/api/get-file-content/${encodeURIComponent(filename)}`); // Use Nginx path
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || `HTTP error ${response.status}`);
        }

        console.log(`Content loaded for ${filename}, length: ${result.content?.length}`);
        setAttachedFileContent(result.content);
        setAttachedFileName(filename); // Set filename for context

    } catch (err: any) {
        console.error(`Failed to load content for ${filename}:`, err);
        setError(`Failed to load content for ${filename}: ${err.message}`); // Show error in chat area
        clearAttachedFile(); // Clear on error
        setSelectedRepoFile(""); // Reset dropdown if load fails
    } finally {
        setIsLoadingFileContent(false);
    }
}, [clearAttachedFile]); // Add dependency
// --- End Load Content ---

  
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

  // Keep handleGenerateDescription - make sure it calls fetchAvailableRepos on success
  const handleGenerateDescription = useCallback(async (
    repoUrl: string, includePatterns: string, excludePatterns: string
): Promise<{ success: boolean; outputFilename?: string; error?: string }> => {
    setIsGenerating(true);
    setGenerationMessage(null);
    clearAttachedFile();
    console.log(`Sending request to Nginx for Repomix...`);
    try {
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
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP error ${response.status}`);
        console.log("Repomix Success:", result);
        fetchAvailableRepos(); // <-- Refresh the list after generating!
        return { success: true, outputFilename: result.outputFilename };
    } catch (err: any) {
        console.error("Repomix generation fetch failed:", err);
        return { success: false, error: err.message || "Failed to connect to Repomix service." };
    }
  
}, [clearAttachedFile, fetchAvailableRepos]); // Add fetchAvailableRepos dependency

  
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
    // const currentHistory = [...chatHistory, newUserMessage];
    // setChatHistory(currentHistory); // Optimistic UI update


    const historyForBackend: ChatMessage[] = chatHistory
    .slice(-MAX_HISTORY_TURNS * 2)
    .map(msg => ({ role: msg.role, parts: msg.parts }));

  // Update chat history state AND scroll down (after the state update)
  setChatHistory(prev => [...prev, newUserMessage]);

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

  // --- Effect to scroll down ---
  useEffect(() => {
    if (scrollableAreaRef.current) {
      // Scroll down when chatHistory changes OR when isLoading becomes true (after user sends message)
      scrollableAreaRef.current.scrollTop = scrollableAreaRef.current.scrollHeight;
    }
    // Trigger scroll also when loading indicator appears for user message
  }, [chatHistory, isLoading]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Gemini Repomix Assistant</h1>
      </header>

      {/* This div contains everything that scrolls */}
      <div className="scrollable-content-area" ref={scrollableAreaRef}> {/* <-- SCROLL container */}

        {/* Repomix Form inside scroll area */}
        <RepomixForm
          onGenerate={handleGenerateDescription}
          isGenerating={isGenerating}
          generationMessage={generationMessage}
          generationError={generationError}
        />

        {/* Repo Selector inside scroll area */}
        <RepoSelector
           repos={availableRepos}
           onSelectRepo={loadRepoFileContent}
           isLoading={isLoadingRepos || isLoadingFileContent}
           selectedValue={selectedRepoFile}
           // disabled={isLoading || isGenerating} // Keep disabling based on chat/gen state
        />
        {/* Repo list error inside scroll area */}
        {repoListError && <div className="error-message repo-error">Failed to load repo list: {repoListError}</div>}

        {/* Chat Interface inside scroll area */}
        <ChatInterface history={chatHistory} />

        {/* Loading/Error indicators related to chat inside scroll area */}
        {/* Show thinking indicator only when waiting for model response */}
        {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
           <div className="loading-indicator">Thinking...</div>
        )}
        {/* Show chat error inside scroll area */}
        {error && <div className="error-message chat-error">Error: {error}</div>}

      </div> {/* <-- END of scrollable-content-area */}

      {/* Input Area is OUTSIDE the scrollable div, but inside the main flex container */}
      <InputArea
        onPromptSubmit={handlePromptSubmit}
        onFileAttach={handleFileAttach}
        // Disable input if EITHER chat response is loading OR repomix is generating
        isLoading={isLoading || isGenerating}
        attachedFileName={attachedFileName}
      />

      <footer className="app-footer">
        {/* Footer content remains outside scroll area */}
      </footer>
    </div>
  );
}

  // return (
  //   <div className="app-container">
  //     <header className="app-header">
  //       <h1>Gemini Repomix Assistant</h1>
  //     </header>

  //     {/* --- Render Repomix Form --- */}
  //     <RepomixForm
  //       onGenerate={handleGenerateDescription}
  //       isGenerating={isGenerating}
  //       generationMessage={generationMessage}
  //       generationError={generationError}
  //     />
  //     {/* --- End Repomix Form --- */}

  //     {/* Render Repo Selector */}
  //     <RepoSelector
  //        repos={availableRepos}
  //        onSelectRepo={loadRepoFileContent}
  //        isLoading={isLoadingRepos || isLoadingFileContent} // Loading if fetching list OR content
  //        //disabled={isLoadingRepos || isGenerating} // Disable if chat/generation busy
  //        selectedValue={selectedRepoFile}
  //     />
  //     {repoListError && <div className="error-message repo-error">Failed to load repo list: {repoListError}</div>}

  //     <div className="chat-scroll-area">
  //       <ChatInterface history={chatHistory} />
  //       {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length-1].role === 'user' && <div className="loading-indicator">Thinking...</div>}
  //       {error && <div className="error-message">Error: {error}</div>}
  //     </div>

  //     <InputArea
  //       onPromptSubmit={handlePromptSubmit}
  //       onFileAttach={handleFileAttach}
  //       isLoading={isLoading}
  //       attachedFileName={attachedFileName}
  //     />

  //     <footer className="app-footer">
  //       {/* ... */}
  //     </footer>
  //   </div>
  // );
//}

export default App;

