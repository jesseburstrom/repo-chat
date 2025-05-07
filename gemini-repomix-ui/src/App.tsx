// gemini-repomix-ui/src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector, { RepoInfo } from './RepoSelector';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
import { parseRepomixFile, ParsedRepomixData } from './utils/parseRepomix';
// --- NEW IMPORTS ---
import ModelSettings, { ClientGeminiModelInfo, TokenStats } from './ModelSettings';
// --- END NEW IMPORTS ---
import './App.css';

export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

const prefix = import.meta.env.DEV ? '' : '/repochat';
console.log(`API Prefix set to: '${prefix}' (Mode: ${import.meta.env.MODE})`);

interface ComparisonViewData {
    filePath: string;
    originalContent: string;
    suggestedContent: string;
}

// --- NEW: Type for backend Gemini API response ---
interface GeminiApiResponse {
    success: boolean;
    text?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    // totalTokens?: number; // Usually input + output, can be derived
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}
// --- END NEW TYPE ---


const MAX_HISTORY_TURNS = 10; // Increased from 5 for more context

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoListError, setRepoListError] = useState<string | null>(null);
  const [selectedRepoFile, setSelectedRepoFile] = useState<string>("");
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
  const attachmentStatusTimer = useRef<number | null>(null);

  const [parsedRepomixData, setParsedRepomixData] = useState<ParsedRepomixData | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingSelectedFile, setIsLoadingSelectedFile] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState<string>(''); // Your existing system prompt state
  const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
  const [isSystemPromptSaving, setIsSystemPromptSaving] = useState<boolean>(false);
  const [systemPromptMessage, setSystemPromptMessage] = useState<string | null>(null);
  const systemPromptMessageTimer = useRef<number | null>(null);

  const [comparisonView, setComparisonView] = useState<ComparisonViewData | null>(null);
  const [isFullScreenView, setIsFullScreenView] = useState(false);

  // --- NEW State for Model Selection and Stats ---
  const [availableModels, setAvailableModels] = useState<ClientGeminiModelInfo[]>([]);
  const [selectedModelCallName, setSelectedModelCallName] = useState<string>(''); // Will be set from backend config
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [currentCallStats, setCurrentCallStats] = useState<TokenStats | null>(null);
  const [totalSessionStats, setTotalSessionStats] = useState<TokenStats>({
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      inputCost: 0, outputCost: 0, totalCost: 0,
  });
  // --- END NEW State ---

  // Load System Prompt (your existing useEffect)
  useEffect(() => {
    const fetchSystemPrompt = async () => {
        console.log("Fetching system prompt (file)...");
        try {
            const response = await fetch(`${prefix}/api/load-system-prompt`);
            const result = await response.json();
            if (result.success && typeof result.systemPrompt === 'string') {
                setSystemPrompt(result.systemPrompt);
                console.log("System prompt (file) loaded.");
            } else {
                setSystemPrompt('');
            }
        } catch (err: any) {
            setSystemPrompt('');
        }
    };
    fetchSystemPrompt();
  }, []);

  // --- NEW: Fetch Gemini Config (Models and Current Selection) ---
  const fetchGeminiConfig = useCallback(async () => {
    setIsLoadingModels(true);
    setError(null); // Clear previous errors
    try {
        const response = await fetch(`${prefix}/api/gemini-config`);
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || `HTTP error ${response.status} fetching Gemini config`);
        }
        setAvailableModels(result.models || []);
        if (result.currentModelCallName) {
            setSelectedModelCallName(result.currentModelCallName);
        } else if (result.models && result.models.length > 0) {
            // Fallback to the first model in the list if no current one is set from backend
            setSelectedModelCallName(result.models[0].callName);
        }
        console.log("Gemini model config loaded. Current selection:", result.currentModelCallName || "None");
    } catch (err: any) {
        console.error("Failed to fetch Gemini config:", err);
        setError("Could not load AI model configurations. Please check the backend. " + err.message);
        setAvailableModels([]); // Clear models on error
    } finally {
        setIsLoadingModels(false);
    }
  }, []);
  // --- END NEW ---


  // Save System Prompt (your existing useCallback)
  const handleSaveSystemPrompt = useCallback(async () => {
    setIsSystemPromptSaving(true);
    setSystemPromptMessage(null);
    if (systemPromptMessageTimer.current) clearTimeout(systemPromptMessageTimer.current);
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
        setSystemPromptMessage('System prompt (file) saved successfully!');
    } catch (err: any) {
        setSystemPromptMessage(`Error saving system prompt (file): ${err.message}`);
    } finally {
        setIsSystemPromptSaving(false);
        systemPromptMessageTimer.current = setTimeout(() => setSystemPromptMessage(null), 3000);
    }
  }, [systemPrompt]);

  const toggleFullScreenView = () => {
    if (parsedRepomixData || comparisonView) {
        setIsFullScreenView(prev => !prev);
    } else {
        setIsFullScreenView(false);
    }
  };

  const clearAttachmentStatus = useCallback(() => {
      if (attachmentStatusTimer.current) {
        clearTimeout(attachmentStatusTimer.current);
        attachmentStatusTimer.current = null;
      }
      setAttachmentStatus(null);
  }, []);

  const fetchAvailableRepos = useCallback(async () => {
      setIsLoadingRepos(true);
      setRepoListError(null);
      try {
          const response = await fetch(`${prefix}/api/list-generated-files`);
          const result = await response.json();
          if (!response.ok || !result.success) {
              throw new Error(result.error || `HTTP error ${response.status}`);
          }
          setAvailableRepos(result.data || []);
      } catch (err: any) {
          setRepoListError(err.message || "Could not load repo list.");
          setAvailableRepos([]);
      } finally {
          setIsLoadingRepos(false);
      }
  }, []);

  // MODIFIED: useEffect to fetch both repos and gemini config
  useEffect(() => {
      fetchAvailableRepos();
      fetchGeminiConfig(); // Fetch model config on initial load
  }, [fetchAvailableRepos, fetchGeminiConfig]); // Add fetchGeminiConfig to dependencies

  const clearFileData = useCallback(() => {
    setAttachedFileContent(null);
    setAttachedFileName(null);
    setParsedRepomixData(null);
    setSelectedFilePath(null);
    setSelectedFileContent(null);
    if (!comparisonView) setIsFullScreenView(false); // Only collapse if not in comparison
  }, [comparisonView]);

  useEffect(() => {
    if (!parsedRepomixData && !comparisonView) {
        setIsFullScreenView(false);
    }
  }, [parsedRepomixData, comparisonView]);

  const handleSelectFile = useCallback((filePath: string) => {
      if (!parsedRepomixData) return;
      if (comparisonView) setComparisonView(null);
      setIsLoadingSelectedFile(true);
      setSelectedFilePath(filePath);
      setTimeout(() => {
          const content = parsedRepomixData.fileContents[filePath];
          setSelectedFileContent(content !== undefined ? content : `// Error: Content not found`);
          setIsLoadingSelectedFile(false);
      }, 50);
  }, [parsedRepomixData, comparisonView]);

  const loadRepoFileContent = useCallback(async (filename: string): Promise<boolean> => {
    if (!filename) {
        clearFileData();
        setSelectedRepoFile("");
        clearAttachmentStatus();
        return false;
    }
    setIsLoadingFileContent(true);
    setError(null);
    setRepoListError(null);
    clearFileData();
    setSelectedRepoFile(filename);
    clearAttachmentStatus();
    setAttachmentStatus(`Attaching ${filename}...`);
    const selectedRepoInfo = availableRepos.find(repo => repo.filename === filename);
    if (selectedRepoInfo?.repoIdentifier) setRepoUrl(`https://github.com/${selectedRepoInfo.repoIdentifier}`);

    try {
        const response = await fetch(`${prefix}/api/get-file-content/${encodeURIComponent(filename)}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP error ${response.status}`);
        setAttachedFileContent(result.content);
        setAttachedFileName(filename);
        const parsedData = parseRepomixFile(result.content);
        if (parsedData) {
            setParsedRepomixData(parsedData);
            setAttachmentStatus(`Attached & Parsed ${filename} successfully.`);
        } else {
            setParsedRepomixData(null);
            setAttachmentStatus(`Attached ${filename} (non-standard format?).`);
        }
        attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 3000);
        return true;
    } catch (err: any) {
        setError(`Failed to load content for ${filename}: ${err.message}`);
        clearFileData();
        setSelectedRepoFile("");
        setAttachmentStatus(`Failed to attach ${filename}.`);
        attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 5000);
        return false;
    } finally {
        setIsLoadingFileContent(false);
    }
  }, [clearFileData, availableRepos, clearAttachmentStatus]);

  const handleFileAttach = useCallback((file: File) => {
      setIsLoading(true);
      setError(null);
      setGenerationMessage(null);
      setGenerationError(null);
      clearAttachmentStatus();
      clearFileData();
      setSelectedRepoFile("");
      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachedFileContent(content);
          setAttachedFileName(file.name);
          const parsedData = parseRepomixFile(content);
          setParsedRepomixData(parsedData);
          setIsLoading(false);
      };
      reader.onerror = (err) => {
          setError(`Error reading file: ${err}`);
          clearFileData();
          setIsLoading(false);
      };
      reader.readAsText(file);
  }, [clearFileData, clearAttachmentStatus]);

  const handleGenerateDescription = useCallback(async (
    generateRepoUrl: string, includePatterns: string, excludePatterns: string
  ) => {
    setIsGenerating(true);
    setGenerationMessage(null);
    setGenerationError(null);
    clearFileData();
    clearAttachmentStatus();
    setSelectedRepoFile("");
    try {
      const response = await fetch(`${prefix}/api/run-repomix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: generateRepoUrl, includePatterns: includePatterns || undefined, excludePatterns: excludePatterns || undefined }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP error ${response.status}`);
      const outputFilename = result.outputFilename;
      if (outputFilename) {
        setGenerationMessage(`Success! Generated: ${outputFilename}. Loading...`);
        await fetchAvailableRepos();
        setTimeout(async () => {
            const loaded = await loadRepoFileContent(outputFilename);
            if (loaded) {
                setGenerationMessage(`Generated & Loaded: ${outputFilename}`);
                setSelectedRepoFile(outputFilename);
            } else {
                setGenerationError(`Generated ${outputFilename}, but failed to load/parse.`);
                setGenerationMessage(null);
            }
        }, 50);
      } else {
         setGenerationError("Repomix finished, but no output filename returned.");
         setGenerationMessage(null);
      }
    } catch (err: any) {
        setGenerationError(err.message || "Failed to run or load Repomix output.");
        setGenerationMessage(null);
    } finally {
        setIsGenerating(false);
    }
  }, [clearFileData, fetchAvailableRepos, loadRepoFileContent, clearAttachmentStatus]);

  const handleStartComparison = (filePath: string, suggestedContent: string) => {
    if (parsedRepomixData?.fileContents[filePath]) {
        setComparisonView({ filePath, originalContent: parsedRepomixData.fileContents[filePath], suggestedContent });
        setSelectedFilePath(null);
        setIsFullScreenView(true);
    } else {
        setError(`Original content for ${filePath} not found.`);
    }
  };

  const handleCloseComparison = () => setComparisonView(null);

  // MODIFIED: handlePromptSubmit to include modelCallName and handle new response
  const handlePromptSubmit = useCallback(async (prompt: string) => {
      if (!prompt && !attachedFileContent) {
          setError("Please type a prompt or attach/select a generated description file.");
          return;
      }
      setIsLoading(true);
      setError(null);
      setGenerationMessage(null);
      setGenerationError(null);
      clearAttachmentStatus();
      setCurrentCallStats(null); // Clear stats for previous call

      let combinedPrompt = "";
      if (attachedFileContent) {
          combinedPrompt += `Attached File Content (${attachedFileName || 'full_description.md'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
      }
      combinedPrompt += prompt ? `User Prompt: ${prompt}` : `User Prompt: Please analyze the attached file content.`;

      const userDisplayPrompt = prompt || `(Using attached file: ${attachedFileName})`;
      const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };

      const historyForBackend: ChatMessage[] = chatHistory
          .slice(-MAX_HISTORY_TURNS * 2)
          .map(msg => ({ role: msg.role, parts: msg.parts }));

      setChatHistory(prev => [...prev, newUserMessage]);
      console.log("Sending request to Backend Gemini Proxy. Model:", selectedModelCallName, "System prompt (file based) length:", systemPrompt.length);

      try {
          const response = await fetch(`${prefix}/api/call-gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: historyForBackend,
                    newMessage: combinedPrompt,
                    systemPrompt: systemPrompt, // Your existing system prompt from file
                    modelCallName: selectedModelCallName, // NEW: Send selected model
                }),
          });
          const result: GeminiApiResponse = await response.json(); // MODIFIED: Use new response type

          if (!response.ok || !result.success) {
              throw new Error(result.error || `API proxy error ${response.status}`);
          }
          const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text || "No text content received." }] };
          setChatHistory(prev => [...prev, newModelMessage]);

          // --- NEW: Update Stats ---
          if (result.inputTokens !== undefined && result.outputTokens !== undefined && result.totalCost !== undefined) {
            const callStatsUpdate: TokenStats = {
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
                inputCost: result.inputCost || 0,
                outputCost: result.outputCost || 0,
                totalCost: result.totalCost || 0,
                modelUsed: result.modelUsed || selectedModelCallName,
            };
            setCurrentCallStats(callStatsUpdate);
            setTotalSessionStats(prev => ({
                inputTokens: prev.inputTokens + callStatsUpdate.inputTokens,
                outputTokens: prev.outputTokens + callStatsUpdate.outputTokens,
                totalTokens: prev.totalTokens + callStatsUpdate.totalTokens,
                inputCost: prev.inputCost + callStatsUpdate.inputCost,
                outputCost: prev.outputCost + callStatsUpdate.outputCost,
                totalCost: prev.totalCost + callStatsUpdate.totalCost,
                modelUsed: prev.modelUsed // Session model used doesn't make as much sense, keep current call's
            }));
            // If backend used a different model (e.g. fallback), update our selection
            if (result.modelUsed && result.modelUsed !== selectedModelCallName) {
                setSelectedModelCallName(result.modelUsed);
                console.log("Model selection updated by backend to:", result.modelUsed);
            }
          } else {
            console.warn("Token stats not received in API response.");
          }
          // --- END NEW Stats Update ---

      } catch (apiError: any) {
          setError(`Error: ${apiError.message}`);
          setChatHistory(prev => prev.slice(0, -1));
      } finally {
          setIsLoading(false);
      }
  }, [chatHistory, attachedFileContent, attachedFileName, clearAttachmentStatus, systemPrompt, selectedModelCallName]); // MODIFIED: Added selectedModelCallName

  // --- NEW: Handler for model change from ModelSettings ---
  const handleModelChange = (newModelCallName: string) => {
    setSelectedModelCallName(newModelCallName);
    // The backend will save this newModelCallName as the 'last selected'
    // when the next /api/call-gemini request is made with it.
    console.log("User selected model (will be sent on next API call):", newModelCallName);
  };
  // --- END NEW ---


  return (
    <div className={`app-container ${isFullScreenView ? 'full-screen-file-view' : ''}`}>
        <header className="app-header">
            <h1>Gemini Repomix Assistant</h1>
            {(parsedRepomixData || comparisonView) && (
                <button
                  onClick={toggleFullScreenView}
                  className="fullscreen-toggle-button"
                  title={isFullScreenView ? "Exit Full Screen View" : "Expand File View"}
                >
                  {isFullScreenView ? '📰 Collapse' : '↔️ Expand'}
                </button>
            )}
        </header>

        <div className={`main-content-wrapper ${isFullScreenView ? 'full-screen-active' : ''}`}>
            {parsedRepomixData && isFullScreenView && !comparisonView && (
                <FileTree
                    structure={parsedRepomixData.directoryStructure}
                    selectedFilePath={selectedFilePath}
                    onSelectFile={handleSelectFile}
                />
            )}

            <div className="center-column">
                <div className="scrollable-content-area">
                    <div className="top-controls-row">
                        {/* Left Half */}
                        <div className="top-controls-left">
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
                            />
                            {/* === MOVED SYSTEM PROMPT (FILE) UI HERE === */}
                            <div className="system-prompt-settings-group">
                                <button
                                    onClick={() => setShowSystemPromptInput(prev => !prev)}
                                    className="toggle-system-prompt-button"
                                    title={showSystemPromptInput ? "Hide System Prompt Editor" : "Edit File-Based System Prompt"}
                                >
                                    {showSystemPromptInput ? 'Hide' : 'Set'} System Prompt (File)
                                </button>
                                {showSystemPromptInput && (
                                    <div className="system-prompt-input-area">
                                        <textarea
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                            placeholder="Define the assistant's role for the file-based prompt..."
                                            rows={3}
                                            className="system-prompt-textarea"
                                            disabled={isSystemPromptSaving}
                                        />
                                        <button
                                            onClick={handleSaveSystemPrompt}
                                            disabled={isSystemPromptSaving || !systemPrompt.trim()}
                                            className="save-system-prompt-button"
                                        >
                                            {isSystemPromptSaving ? 'Saving...' : 'Save to File'}
                                        </button>
                                        {systemPromptMessage && (
                                            <p className={`system-prompt-status ${systemPromptMessage.includes('Error') ? 'error' : 'success'}`}>
                                                {systemPromptMessage}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* === END MOVED SYSTEM PROMPT (FILE) UI === */}
                        </div>

                        {/* Right Half - Now only ModelSettings */}
                        <div className="top-controls-right">
                            <ModelSettings
                                availableModels={availableModels}
                                selectedModelCallName={selectedModelCallName}
                                onModelChange={handleModelChange}
                                isLoadingModels={isLoadingModels}
                                currentCallStats={currentCallStats}
                                totalSessionStats={totalSessionStats}
                                isChatLoading={isLoading}
                            />
                        </div>
                    </div>

                    {/* ... (rest of the scrollable content: attachmentStatus, repoListError, ChatInterface, etc.) */}
                    {attachmentStatus && (
                        <div className={`attachment-status ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') ? 'warning' : 'success'}`}>
                            {attachmentStatus}
                        </div>
                    )}
                    {repoListError && <div className="error-message repo-error">Failed to load repo list: {repoListError}</div>}
                    <ChatInterface history={chatHistory} onStartComparison={handleStartComparison} parsedRepomixData={parsedRepomixData}/>
                    {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                        <div className="loading-indicator">Thinking...</div>
                    )}
                    {error && <div className="error-message chat-error">{error}</div>}
                </div>

                <InputArea
                    onPromptSubmit={handlePromptSubmit}
                    onFileAttach={handleFileAttach}
                    isLoading={isLoading || isGenerating || isLoadingSelectedFile || isLoadingModels}
                    attachedFileName={attachedFileName}
                />
            </div>

            {(parsedRepomixData || comparisonView) && isFullScreenView && (
                <FileContentDisplay
                    filePath={selectedFilePath}
                    content={selectedFileContent}
                    isLoading={isLoadingSelectedFile && !comparisonView}
                    comparisonData={comparisonView}
                    onCloseComparison={handleCloseComparison}
                />
            )}
        </div>

        <footer className="app-footer">
            {/* Footer content */}
        </footer>
    </div>
);
}

export default App;