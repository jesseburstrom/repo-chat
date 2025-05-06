// gemini-repomix-ui/src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector, { RepoInfo } from './RepoSelector';
import FileTree from './FileTree';                 // <-- Import FileTree
import FileContentDisplay from './FileContentDisplay'; // <-- Import FileContentDisplay
import { parseRepomixFile, ParsedRepomixData } from './utils/parseRepomix'; // <-- Import parser
import './App.css';

export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}
// --- DYNAMIC PREFIX ---
// In development (npm run dev), import.meta.env.DEV will be true.
// For production builds, import.meta.env.PROD will be true.
const prefix = import.meta.env.DEV ? '' : '/repochat';
console.log(`API Prefix set to: '${prefix}' (Mode: ${import.meta.env.MODE})`);
// --- END DYNAMIC PREFIX ---
const MAX_HISTORY_TURNS = 5;

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false); // For chat response loading
  const [error, setError] = useState<string | null>(null);
  const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // Repomix Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Repo Selector State
  const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoListError, setRepoListError] = useState<string | null>(null);
  const [selectedRepoFile, setSelectedRepoFile] = useState<string>("");
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const attachmentStatusTimer = useRef<number | null>(null);

  // --- NEW State for Parsed Repomix Data ---
  const [parsedRepomixData, setParsedRepomixData] = useState<ParsedRepomixData | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingSelectedFile, setIsLoadingSelectedFile] = useState(false); // For clarity, separate loading state

  // --- NEW: System Prompt State ---
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
  const [isSystemPromptSaving, setIsSystemPromptSaving] = useState<boolean>(false);
  const [systemPromptMessage, setSystemPromptMessage] = useState<string | null>(null);
  const systemPromptMessageTimer = useRef<number | null>(null);
  // --- END System Prompt State ---
  // --- Load System Prompt on Mount ---
useEffect(() => {
  const fetchSystemPrompt = async () => {
      console.log("Fetching system prompt...");
      try {
          const response = await fetch(`${prefix}/api/load-system-prompt`);
          const result = await response.json();
          if (result.success && typeof result.systemPrompt === 'string') {
              setSystemPrompt(result.systemPrompt);
              console.log("System prompt loaded from server.");
          } else {
              console.warn("Failed to load system prompt or none set:", result.error);
              setSystemPrompt('');
          }
      } catch (err: any) {
          console.error("Error fetching system prompt:", err);
          setSystemPrompt('');
      }
  };
  fetchSystemPrompt();
}, []); // Empty dependency array: run once on mount

// --- Save System Prompt ---
const handleSaveSystemPrompt = useCallback(async () => {
  setIsSystemPromptSaving(true);
  setSystemPromptMessage(null);
  if (systemPromptMessageTimer.current) clearTimeout(systemPromptMessageTimer.current);

  console.log("Saving system prompt...");
  try {
      const response = await fetch(`${prefix}/api/save-system-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to save system prompt.');
      }
      setSystemPromptMessage('System prompt saved successfully!');
      console.log("System prompt saved.");
  } catch (err: any) {
      setSystemPromptMessage(`Error saving: ${err.message}`);
      console.error("Error saving system prompt:", err);
  } finally {
      setIsSystemPromptSaving(false);
      systemPromptMessageTimer.current = setTimeout(() => setSystemPromptMessage(null), 3000);
  }
}, [systemPrompt]);

  // --- NEW: Full Screen State ---
  const [isFullScreenView, setIsFullScreenView] = useState(false);

  // --- Toggle Function ---
  const toggleFullScreenView = () => {
    if (parsedRepomixData) { // Only allow toggle if file view is active
        setIsFullScreenView(prev => !prev);
    } else {
        setIsFullScreenView(false); // Ensure it's off if no file view
    }
  };

  const clearAttachmentStatus = useCallback(() => {
      // ... (implementation unchanged)
      if (attachmentStatusTimer.current) {
        clearTimeout(attachmentStatusTimer.current);
        attachmentStatusTimer.current = null;
      }
      setAttachmentStatus(null);
  }, []);

  const fetchAvailableRepos = useCallback(async () => {
      // ... (implementation unchanged)
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
      fetchAvailableRepos();
  }, [fetchAvailableRepos]);

  // --- Clear All File-Related State ---
  const clearFileData = useCallback(() => {
    setAttachedFileContent(null);
    setAttachedFileName(null);
    setParsedRepomixData(null); // Clear parsed data
    setSelectedFilePath(null);  // Clear selected file
    setSelectedFileContent(null); // Clear displayed content
    setIsFullScreenView(false);
    console.log("All attached/parsed file data cleared.");
  }, []);

  // --- Ensure full screen turns off if parsedData becomes null ---
  useEffect(() => {
    if (!parsedRepomixData) {
        setIsFullScreenView(false);
    }
  }, [parsedRepomixData]);

  // --- Handle File Selection in Tree ---
  const handleSelectFile = useCallback((filePath: string) => {
      if (!parsedRepomixData) return;

      setIsLoadingSelectedFile(true); // Indicate loading
      setSelectedFilePath(filePath);
      // Simulate async loading if needed, or just set directly
      // Using setTimeout to show loading state briefly for demo
      setTimeout(() => {
          const content = parsedRepomixData.fileContents[filePath];
          if (content !== undefined) {
              setSelectedFileContent(content);
          } else {
              console.warn(`Content for selected file path "${filePath}" not found in parsed data.`);
              setSelectedFileContent(`// Error: Content not found for ${filePath}`);
          }
          setIsLoadingSelectedFile(false);
      }, 50); // Short delay

  }, [parsedRepomixData]);


  // Modified Load Content Function
  const loadRepoFileContent = useCallback(async (filename: string): Promise<boolean> => {
    if (!filename) {
        clearFileData(); // Use the new clear function
        setSelectedRepoFile("");
        clearAttachmentStatus();
        return false;
    }
    setIsLoadingFileContent(true);
    setError(null);
    setRepoListError(null);
    clearFileData(); // Clear previous data first
    setSelectedRepoFile(filename);
    clearAttachmentStatus();
    setAttachmentStatus(`Attaching ${filename}...`);
    console.log(`Loading content for: ${filename}`);

    // Set Repo URL input
    const selectedRepoInfo = availableRepos.find(repo => repo.filename === filename);
     if (selectedRepoInfo && selectedRepoInfo.repoIdentifier) {
         const potentialUrl = `https://github.com/${selectedRepoInfo.repoIdentifier}`;
         setRepoUrl(potentialUrl);
         console.log(`Set repo URL input to: ${potentialUrl}`);
     } else {
         console.warn(`Could not find repoIdentifier for filename: ${filename}`);
     }

    try {
        const response = await fetch(`${prefix}/api/get-file-content/${encodeURIComponent(filename)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || `HTTP error ${response.status}`);
        }

        console.log(`Content loaded for ${filename}, length: ${result.content?.length}`);
        setAttachedFileContent(result.content); // Still store raw content
        setAttachedFileName(filename);

        // --- Attempt to parse the loaded content ---
        console.log(`Received content from backend for ${filename}. Length: ${result.content?.length}`);
        // Log the raw content received ON THE CLIENT
        // console.log("Raw content received:", result.content); // Be careful logging large content
        const parsedData = parseRepomixFile(result.content);
        console.log("Parsed data:", parsedData); // Check if this is null
        if (parsedData) {
            setParsedRepomixData(parsedData);
            setAttachmentStatus(`Attached & Parsed ${filename} successfully.`);
        } else {
            // Content loaded, but not parsable as Repomix file
            setParsedRepomixData(null); // Ensure it's cleared
            setAttachmentStatus(`Attached ${filename} (non-standard format?).`);
            console.warn(`File ${filename} loaded but could not be parsed for tree view.`);
        }
        // --- End Parsing ---

        attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 3000);
        return true;

    } catch (err: any) {
        console.error(`Failed to load content for ${filename}:`, err);
        setError(`Failed to load content for ${filename}: ${err.message}`);
        clearFileData(); // Clear all on error
        setSelectedRepoFile("");
        setAttachmentStatus(`Failed to attach ${filename}.`);
        attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 5000);
        return false;
    } finally {
        setIsLoadingFileContent(false);
    }
}, [clearFileData, availableRepos, clearAttachmentStatus]); // Use clearFileData dependency

  // Modified File Attach Handler
  const handleFileAttach = useCallback((file: File) => {
      setIsLoading(true); // Use chat loading indicator
      setError(null);
      setGenerationMessage(null);
      setGenerationError(null);
      clearAttachmentStatus();
      clearFileData(); // Clear previous data
      setSelectedRepoFile(""); // Deselect repo dropdown

      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachedFileContent(content);
          setAttachedFileName(file.name);
          console.log(`Attached file ${file.name} (${(content?.length ?? 0)} chars)`);

          // --- Attempt to parse ---
          const parsedData = parseRepomixFile(content);
          if (parsedData) {
              setParsedRepomixData(parsedData);
              console.log(`Parsed attached file ${file.name} successfully.`);
          } else {
              setParsedRepomixData(null);
              console.warn(`Attached file ${file.name} could not be parsed for tree view.`);
          }
          // --- End Parsing ---

          setIsLoading(false);
      };
      reader.onerror = (err) => {
          console.error("File reading error:", err);
          setError(`Error reading file: ${err}`);
          clearFileData();
          setIsLoading(false);
      };
      reader.readAsText(file);
  }, [clearFileData, clearAttachmentStatus]); // Use clearFileData dependency

  // Modified Generate Handler
  const handleGenerateDescription = useCallback(async (
    generateRepoUrl: string, includePatterns: string, excludePatterns: string
  ) => {
    setIsGenerating(true);
    setGenerationMessage(null);
    setGenerationError(null);
    clearFileData(); // Clear previous data
    clearAttachmentStatus();
    setSelectedRepoFile("");
    console.log(`Sending request for Repomix generation: ${generateRepoUrl}`);

    try {
      const response = await fetch(`${prefix}/api/run-repomix`, { /* ... */
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            repoUrl: generateRepoUrl,
            includePatterns: includePatterns || undefined,
            excludePatterns: excludePatterns || undefined,
        }),
      });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP error ${response.status}`);

        const outputFilename = result.outputFilename;
        if (outputFilename) {
            setGenerationMessage(`Success! Generated: ${outputFilename}. Loading content...`);
            await fetchAvailableRepos(); // Refresh list
            // Use setTimeout to ensure state updates settle before loading
            setTimeout(async () => {
                const loaded = await loadRepoFileContent(outputFilename); // Await loading
                if (loaded) {
                    // Successfully loaded AND parsed (handled inside loadRepoFileContent)
                    setGenerationMessage(`Generated & Loaded: ${outputFilename}`);
                    setSelectedRepoFile(outputFilename); // Ensure dropdown is selected
                } else {
                    // Loading or parsing failed
                    setGenerationError(`Generated ${outputFilename}, but failed to load/parse content.`);
                    setGenerationMessage(null);
                }
            }, 50); // Small delay
        } else {
             setGenerationError("Repomix finished, but no output filename was returned.");
             setGenerationMessage(null);
        }
    } catch (err: any) {
        console.error("Repomix generation/load failed:", err);
        setGenerationError(err.message || "Failed to run or load Repomix output.");
        setGenerationMessage(null);
    } finally {
        setIsGenerating(false);
    }
  }, [clearFileData, fetchAvailableRepos, loadRepoFileContent, clearAttachmentStatus]); // Use clearFileData dependency

  // Handle Prompt Submit (Largely Unchanged, uses attachedFileContent)
  const handlePromptSubmit = useCallback(async (prompt: string) => {
      if (!prompt && !attachedFileContent) {
          setError("Please type a prompt or attach/select a generated description file.");
          return;
      }
      // Reset selection in tree view when starting a new chat thread? Optional.
      // setSelectedFilePath(null);
      // setSelectedFileContent(null);

      setIsLoading(true);
      setError(null);
      setGenerationMessage(null);
      setGenerationError(null);
      clearAttachmentStatus();

      let combinedPrompt = "";
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

      const historyForBackend: ChatMessage[] = chatHistory
          .slice(-MAX_HISTORY_TURNS * 2)
          .map(msg => ({ role: msg.role, parts: msg.parts }));

      setChatHistory(prev => [...prev, newUserMessage]);
      console.log("Sending request to Backend Gemini Proxy with system prompt length:", systemPrompt.length);

      try {
          const response = await fetch(`${prefix}/api/call-gemini`, { // ... (fetch options unchanged)
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    history: historyForBackend,
                    newMessage: combinedPrompt,
                    systemPrompt: systemPrompt,
                }),
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
              throw new Error(result.error || `API proxy error ${response.status}`);
          }
          const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text }] };
          setChatHistory(prev => [...prev, newModelMessage]);
          // Do NOT clear file data on successful chat message anymore
          // clearFileData();

      } catch (apiError: any) {
          setError(`Error: ${apiError.message}`);
          setChatHistory(prev => prev.slice(0, -1)); // Rollback user message
      } finally {
          setIsLoading(false);
      }
  }, [chatHistory, attachedFileContent, attachedFileName, clearAttachmentStatus, systemPrompt]); // Removed clearFileData dep


  return (
      <div className={`app-container ${isFullScreenView ? 'full-screen-file-view' : ''}`}>
          <header className="app-header">
              <h1>Gemini Repomix Assistant</h1>
              {parsedRepomixData && ( // Only show button when file view is possible
                  <button
                    onClick={toggleFullScreenView}
                    className="fullscreen-toggle-button" // Add a class for styling
                    title={isFullScreenView ? "Exit Full Screen View" : "Expand File View"}
                  >
                    {isFullScreenView ? '📰 Collapse' : '↔️ Expand'}
                  </button>
              )}
          </header>

          {/* --- NEW: Main Content Wrapper for Flex Layout --- */}
          <div className={`main-content-wrapper ${isFullScreenView ? 'full-screen-active' : ''}`}>

              {/* --- MODIFIED: Conditional FileTree Panel (Left) --- */}
              {/* Now renders only if a file is parsed AND the view is expanded */}
              {parsedRepomixData && isFullScreenView && (
                  <FileTree
                      structure={parsedRepomixData.directoryStructure}
                      selectedFilePath={selectedFilePath}
                      onSelectFile={handleSelectFile}
                  />
              )}

              {/* --- Center Column (Chat Area + Input) --- */}
              <div className="center-column"> {/* New wrapper for center */}
                  <div className="scrollable-content-area">
                      <RepomixForm
                          repoUrl={repoUrl}
                          onRepoUrlChange={setRepoUrl}
                          onGenerate={handleGenerateDescription}
                          isGenerating={isGenerating}
                          generationMessage={generationMessage}
                          generationError={generationError}
                      />
                      <RepoSelector
                          repos={availableRepos}
                          onSelectRepo={loadRepoFileContent}
                          isLoading={isLoadingRepos || isLoadingFileContent}
                          selectedValue={selectedRepoFile}
                          // disabled={isLoading || isGenerating} // Can still disable if needed
                      />
                      {/* --- NEW System Prompt Area --- */}
                      <div className="system-prompt-section"> {/* New container for styling */}
                          <button
                              onClick={() => setShowSystemPromptInput(prev => !prev)}
                              className="toggle-system-prompt-button"
                          >
                              {showSystemPromptInput ? 'Hide' : 'Set'} System Prompt
                          </button>
                          {showSystemPromptInput && (
                              <div className="system-prompt-input-area">
                                  <textarea
                                      value={systemPrompt}
                                      onChange={(e) => setSystemPrompt(e.target.value)}
                                      placeholder="Define the assistant's role, personality, and general instructions here..."
                                      rows={4}
                                      className="system-prompt-textarea"
                                      disabled={isSystemPromptSaving}
                                  />
                                  <button
                                      onClick={handleSaveSystemPrompt}
                                      disabled={isSystemPromptSaving || !systemPrompt.trim()} // Disable if empty
                                      className="save-system-prompt-button"
                                  >
                                      {isSystemPromptSaving ? 'Saving...' : 'Save System Prompt'}
                                  </button>
                                  {systemPromptMessage && (
                                      <p className={`system-prompt-status ${systemPromptMessage.includes('Error') ? 'error' : 'success'}`}>
                                          {systemPromptMessage}
                                      </p>
                                  )}
                              </div>
                          )}
                      </div>
                      {/* --- END System Prompt Area --- */}
                      {attachmentStatus && (
                          <div className={`attachment-status ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') ? 'warning' : 'success'}`}>
                              {attachmentStatus}
                          </div>
                      )}
                      {repoListError && <div className="error-message repo-error">Failed to load repo list: {repoListError}</div>}
                      <ChatInterface history={chatHistory} />
                      {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                          <div className="loading-indicator">Thinking...</div>
                      )}
                      {error && <div className="error-message chat-error">Error: {error}</div>}
                  </div>

                  <InputArea
                      onPromptSubmit={handlePromptSubmit}
                      onFileAttach={handleFileAttach}
                      isLoading={isLoading || isGenerating || isLoadingSelectedFile} // Disable input when loading file content too
                      attachedFileName={attachedFileName}
                  />
              </div> {/* --- End Center Column --- */}

              {/* --- MODIFIED: Conditional FileContentDisplay Panel (Right) --- */}
              {/* Now renders only if a file is parsed AND the view is expanded */}
              {parsedRepomixData && isFullScreenView && (
                  <FileContentDisplay
                      filePath={selectedFilePath}
                      content={selectedFileContent}
                      isLoading={isLoadingSelectedFile} // Pass loading state
                  />
              )}

          </div> {/* --- End Main Content Wrapper --- */}

          <footer className="app-footer">
              {/* Footer content */}
          </footer>
      </div>
  );
}

export default App;
// // gemini-repomix-ui/src/App.tsx
// import { useState, useEffect, useCallback, useRef } from 'react';
// import ChatInterface from './ChatInterface';
// import InputArea from './InputArea';
// import RepomixForm from './RepomixForm'; // <-- Use the form again
// import RepoSelector, { RepoInfo } from './RepoSelector'; 
// import './App.css';

// // Define ChatMessage type locally now or in a types file
// export interface ChatMessage {
//   role: "user" | "model";
//   parts: [{ text: string }];
// }
// var prefix = '';
// //prefix = '/repochat';

// const MAX_HISTORY_TURNS = 5;

// function App() {
//   const [repoUrl, setRepoUrl] = useState(''); // <-- Add state for repo URL

//   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
//   const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

//   // --- State for Repomix Form ---
//   const [isGenerating, setIsGenerating] = useState(false); // Loading for repomix generation
//   const [generationMessage, setGenerationMessage] = useState<string | null>(null);
//   const [generationError, setGenerationError] = useState<string | null>(null);
//   // --- End Repomix State ---

  

//    // --- Repo Selector State ---
//    const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
//    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
//    const [repoListError, setRepoListError] = useState<string | null>(null);
//    const [selectedRepoFile, setSelectedRepoFile] = useState<string>(""); // Control dropdown value
//    const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
//    const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null); // NEW: Status for attaching
//    const attachmentStatusTimer = useRef<number | null>(null); // Timer for clearing status
//    // --- End Repo Selector State ---
  
//   // --- Utility to clear attachment status message ---
//   const clearAttachmentStatus = useCallback(() => {
//     if (attachmentStatusTimer.current) {
//       clearTimeout(attachmentStatusTimer.current);
//       attachmentStatusTimer.current = null;
//     }
//     setAttachmentStatus(null);
//   }, []);
//    // --- Fetch Available Repos on Mount ---
//   const fetchAvailableRepos = useCallback(async () => {
//     setIsLoadingRepos(true);
//     setRepoListError(null);
//     console.log("Fetching available repo files...");
//     try {
//         const response = await fetch(`${prefix}/api/list-generated-files`); // Use Nginx path
//         const result = await response.json();
//         if (!response.ok || !result.success) {
//             throw new Error(result.error || `HTTP error ${response.status}`);
//         }
//         console.log("Available repos fetched:", result.data);
//         setAvailableRepos(result.data || []);
//     } catch (err: any) {
//         console.error("Failed to fetch repo list:", err);
//         setRepoListError(err.message || "Could not load repo list.");
//         setAvailableRepos([]); // Clear list on error
//     } finally {
//         setIsLoadingRepos(false);
//     }
// }, []);

// useEffect(() => {
//     fetchAvailableRepos(); // Fetch on initial load
// }, [fetchAvailableRepos]);
// // --- End Fetch Repos ---

// const clearAttachedFile = useCallback(() => {
//   setAttachedFileContent(null);
//   setAttachedFileName(null);
//   console.log("Attached file cleared.");
// }, []);


// // --- Load Content for Selected Repo (MODIFIED) ---
// // Make it async and return a boolean indicating success
// const loadRepoFileContent = useCallback(async (filename: string): Promise<boolean> => {
//   if (!filename) {
//       clearAttachedFile();
//       setSelectedRepoFile("");
//       clearAttachmentStatus();
//       return false; // Indicate failure (or neutral state) if no filename
//   }
//     setIsLoadingFileContent(true);
//     setError(null); // Clear chat errors
//     setRepoListError(null); // Clear repo errors
//     clearAttachedFile(); // Clear any manually attached file first
//     setSelectedRepoFile(filename); // Update dropdown state
//     clearAttachmentStatus(); // Clear previous status
//     setAttachmentStatus(`Attaching ${filename}...`); // Show attaching message
//     console.log(`Loading content for: ${filename}`);

//     // --- Find Repo Identifier and Set URL ---
//     const selectedRepoInfo = availableRepos.find(repo => repo.filename === filename);
//     if (selectedRepoInfo && selectedRepoInfo.repoIdentifier) {
//         const potentialUrl = `https://github.com/${selectedRepoInfo.repoIdentifier}`; // Construct URL
//         setRepoUrl(potentialUrl); // Update the repoUrl state
//         console.log(`Set repo URL input to: ${potentialUrl}`);
//     } else {
//         console.warn(`Could not find repoIdentifier for filename: ${filename}`);
//         // Optionally clear the URL if identifier not found, or leave it as is
//         // setRepoUrl("");
//     }
//     // --- End URL Setting ---

//     try {
//         const response = await fetch(`${prefix}/api/get-file-content/${encodeURIComponent(filename)}`); // Use Nginx path
//         const result = await response.json();

//         if (!response.ok || !result.success) {
//             throw new Error(result.error || `HTTP error ${response.status}`);
//         }

//         console.log(`Content loaded for ${filename}, length: ${result.content?.length}`);
//         setGenerationMessage(`Content loaded for ${filename}, length: ${result.content?.length}`);
//         setAttachedFileContent(result.content);
//         setAttachedFileName(filename); // Set filename for context
//         setAttachmentStatus(`Attached ${filename} successfully.`); // Show success message
//          // Clear success message after a delay
//         attachmentStatusTimer.current = setTimeout(() => {
//             clearAttachmentStatus();
//         }, 3000); // 3 seconds
//         return true;

//     } catch (err: any) {
//         console.error(`Failed to load content for ${filename}:`, err);
//         setError(`Failed to load content for ${filename}: ${err.message}`); // Show error in chat area
//         clearAttachedFile(); // Clear on error
//         setSelectedRepoFile(""); // Reset dropdown if load fails
//         setAttachmentStatus(`Failed to attach ${filename}.`); // Show failure message
//         // Clear failure message after a delay
//         attachmentStatusTimer.current = setTimeout(() => {
//              clearAttachmentStatus();
//         }, 5000); // 5 seconds
//         return false;
//     } finally {
//         setIsLoadingFileContent(false);
//     }
// }, [clearAttachedFile, availableRepos]); // Add dependency
// // --- End Load Content ---

  
//   const handleFileAttach = useCallback((file: File) => {
//       setIsLoading(true); // Use the chat loading indicator briefly
//       setError(null);
//       setGenerationMessage(null); // Clear generation messages on manual attach
//       setGenerationError(null);
//       clearAttachmentStatus();
//       const reader = new FileReader();
//       reader.onload = (event) => {
//           const content = event.target?.result as string;
//           setAttachedFileContent(content);
//           setAttachedFileName(file.name);
//           setSelectedRepoFile("");
//           console.log(`Attached file ${file.name} (${(content?.length ?? 0)} chars)`);
//           setIsLoading(false);
//       };
//       reader.onerror = (err) => {
//           console.error("File reading error:", err);
//           setError(`Error reading file: ${err}`);
//           setAttachedFileContent(null);
//           setAttachedFileName(null);
//           setIsLoading(false);
//       };
//       reader.readAsText(file);
//   }, []);

//   // Keep handleGenerateDescription - make sure it calls fetchAvailableRepos on success
//   const handleGenerateDescription = useCallback(async (
//     // Note: repoUrl now comes from App's state, but we still accept it as an argument
//     // for clarity, though we could read it directly from state too.
//     generateRepoUrl: string, includePatterns: string, excludePatterns: string
// ) => {
//     setIsGenerating(true);
//     setGenerationMessage(null);
//     setGenerationError(null); // Clear previous errors/messages
//     clearAttachedFile();
//     clearAttachmentStatus(); // Clear attachment status too
//     setSelectedRepoFile(""); // Deselect any previously selected repo
//     setSelectedRepoFile(""); // Reset dropdown selection
//     console.log(`Sending request to Nginx for Repomix generation: ${generateRepoUrl}`);
//     try {
//       const response = await fetch(`${prefix}/api/run-repomix`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//             repoUrl: generateRepoUrl, // Use the URL passed to the function
//             includePatterns: includePatterns || undefined,
//             excludePatterns: excludePatterns || undefined,
//         }),
//       });
//         const result = await response.json();
//         if (!response.ok || !result.success) throw new Error(result.error || `HTTP error ${response.status}`);
//         console.log("Repomix Success:", result);
//         const outputFilename = result.outputFilename;
//         // --- Success Handling ---
        
//         // --- Auto-load the generated file ---
//         if (outputFilename) {
//           setGenerationMessage(`Success! Generated: ${outputFilename}. Loading content...`); // Show success message
//           await fetchAvailableRepos(); // <-- Refresh the list after generating!
//           // Need a slight delay or ensure state updates settle before loading
//           // Using setTimeout 0 can help push it to the next event loop tick
//           setTimeout(() => {
//               loadRepoFileContent(outputFilename);
//               // Ensure the dropdown visually updates AFTER the repo list might have refreshed
//               // and the file content load function finishes
//               setSelectedRepoFile(outputFilename);
//           }, 0);
//       } else {
//         // Load failed, loadRepoFileContent has set error/status messages.
//         // Update the message in the generation area too.
//         setGenerationError(`Failed to load content for ${outputFilename}. See status below dropdown.`);
//         setGenerationMessage(null); // Clear the "Loading..." message
//       }
//       // Keep the repoUrl in the input field (already handled by state)
//       // --- End Auto-load ---
//         //return { success: true, outputFilename: result.outputFilename };
//     } catch (err: any) {
//       console.error("Repomix generation fetch failed:", err);
//       setGenerationError(err.message || "Failed to connect to Repomix service."); // Show error message
//       setGenerationMessage(null); // Clear success message
//   } finally {
//       setIsGenerating(false); // <--- Ensure this always runs
//   }
  
// }, [clearAttachedFile, fetchAvailableRepos, loadRepoFileContent, clearAttachmentStatus]);

  
//   const handlePromptSubmit = useCallback(async (prompt: string) => {
//     if (!prompt && !attachedFileContent) {
//       setError("Please type a prompt or attach the generated description file.");
//       return;
//     }
//     setIsLoading(true);
//     setError(null);
//     setGenerationMessage(null); // Clear statuses when submitting chat
//     setGenerationError(null);
//     clearAttachmentStatus();

//     let combinedPrompt = ""; // Build the full message content for the backend
//     if (attachedFileContent) {
//         combinedPrompt += `Attached File Content (${attachedFileName || 'full_description.md'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
//     }
    
//     if (prompt) {
//         combinedPrompt += `User Prompt: ${prompt}`;
//     } else {
//         combinedPrompt += `User Prompt: Please analyze the attached file content.`;
//     }

//     const userDisplayPrompt = prompt || `(Using attached file: ${attachedFileName})`;
//     const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };

//     const historyForBackend: ChatMessage[] = chatHistory
//     .slice(-MAX_HISTORY_TURNS * 2)
//     .map(msg => ({ role: msg.role, parts: msg.parts }));

//   // Update chat history state AND scroll down (after the state update)
//   setChatHistory(prev => [...prev, newUserMessage]);

//   console.log("Sending request to Backend Gemini Proxy");
      
//       try {
//           // *** CALL YOUR BACKEND PROXY ENDPOINT ***
//           const response = await fetch(`${prefix}/api/call-gemini`, { // Adjust path if needed based on Nginx
//               method: 'POST',
//               headers: {
//                   'Content-Type': 'application/json',
//               },
//               body: JSON.stringify({
//                   // Send history and the combined new message
//                   history: historyForBackend, // Send previous turns
//                   newMessage: combinedPrompt,  // Send the full new content
//               }),
//           });

//           const result = await response.json();

//           if (!response.ok || !result.success) {
//               throw new Error(result.error || `API proxy error ${response.status}`);
//           }

//           const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text }] };
//           setChatHistory(prev => [...prev, newModelMessage]);
//           //clearAttachedFile(); // Clear file on success

//       } catch (apiError: any) {
//           setError(`Error: ${apiError.message}`);
//           // Rollback optimistic UI update
//           setChatHistory(prev => prev.slice(0, -1));
//       } finally {
//           setIsLoading(false);
//       }
//   }, [chatHistory, attachedFileContent, attachedFileName, clearAttachedFile]);


//   return (
//     <div className="app-container">
//       <header className="app-header">
//         <h1>Gemini Repomix Assistant</h1>
//       </header>

//       {/* This div contains everything that scrolls */}
//       <div className="scrollable-content-area" > {/* <-- SCROLL container */}

//         {/* Repomix Form inside scroll area */}
//         <RepomixForm
//           repoUrl={repoUrl} // Pass state down
//           onRepoUrlChange={setRepoUrl} // Pass setter down
//           onGenerate={handleGenerateDescription}
//           isGenerating={isGenerating}
//           generationMessage={generationMessage}
//           generationError={generationError}
//         />

//         {/* Repo Selector inside scroll area */}
//         <RepoSelector
//            repos={availableRepos}
//            onSelectRepo={loadRepoFileContent}
//            isLoading={isLoadingRepos || isLoadingFileContent}
//            selectedValue={selectedRepoFile}
//            // disabled={isLoading || isGenerating} // Keep disabling based on chat/gen state
//         />
//         {/* --- Display Attachment Status --- */}
//         {attachmentStatus && (
//           <div className={`attachment-status ${attachmentStatus.includes('Failed') ? 'error' : 'success'}`}>
//               {attachmentStatus}
//           </div>
//         )}
//       {/* --- End Display Attachment Status --- */}
//         {/* Repo list error inside scroll area */}
//         {repoListError && <div className="error-message repo-error">Failed to load repo list: {repoListError}</div>}

//         {/* Chat Interface inside scroll area */}
//         <ChatInterface history={chatHistory} />

//         {/* Loading/Error indicators related to chat inside scroll area */}
//         {/* Show thinking indicator only when waiting for model response */}
//         {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
//            <div className="loading-indicator">Thinking...</div>
//         )}
//         {/* Show chat error inside scroll area */}
//         {error && <div className="error-message chat-error">Error: {error}</div>}

//       </div> {/* <-- END of scrollable-content-area */}

//       {/* Input Area is OUTSIDE the scrollable div, but inside the main flex container */}
//       <InputArea
//         onPromptSubmit={handlePromptSubmit}
//         onFileAttach={handleFileAttach}
//         // Disable input if EITHER chat response is loading OR repomix is generating
//         isLoading={isLoading || isGenerating}
//         attachedFileName={attachedFileName}
//       />

//       <footer className="app-footer">
//         {/* Footer content remains outside scroll area */}
//       </footer>
//     </div>
//   );
// }

// export default App;

