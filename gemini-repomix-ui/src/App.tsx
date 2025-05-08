// gemini-repomix-ui/src/App.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector, { RepoInfo } from './RepoSelector';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
import { parseRepomixFile, ParsedRepomixData } from './utils/parseRepomix';
import ModelSettings, { ClientGeminiModelInfo, TokenStats } from './ModelSettings';
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

interface GeminiApiResponse {
    success: boolean;
    text?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}

const MAX_HISTORY_TURNS = 10;

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

  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
  const [isSystemPromptSaving, setIsSystemPromptSaving] = useState<boolean>(false);
  const [systemPromptMessage, setSystemPromptMessage] = useState<string | null>(null);
  const systemPromptMessageTimer = useRef<number | null>(null);

  const [comparisonView, setComparisonView] = useState<ComparisonViewData | null>(null);
  const [isFullScreenView, setIsFullScreenView] = useState(false);

  const [promptSelectedFilePaths, setPromptSelectedFilePaths] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<ClientGeminiModelInfo[]>([]);
  const [selectedModelCallName, setSelectedModelCallName] = useState<string>('');
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [currentCallStats, setCurrentCallStats] = useState<TokenStats | null>(null);
  const [totalSessionStats, setTotalSessionStats] = useState<TokenStats>({
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      inputCost: 0, outputCost: 0, totalCost: 0,
  });

  useEffect(() => {
    const fetchSystemPrompt = async () => {
        try {
            const response = await fetch(`${prefix}/api/load-system-prompt`);
            const result = await response.json();
            if (result.success && typeof result.systemPrompt === 'string') {
                setSystemPrompt(result.systemPrompt);
            } else {
                setSystemPrompt('');
            }
        } catch (err: any) {
            setSystemPrompt('');
        }
    };
    fetchSystemPrompt();
  }, []);

  const fetchGeminiConfig = useCallback(async () => {
    setIsLoadingModels(true);
    setError(null);
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
            setSelectedModelCallName(result.models[0].callName);
        }
    } catch (err: any) {
        console.error("Failed to fetch Gemini config:", err);
        setError("Could not load AI model configurations. Please check the backend. " + err.message);
        setAvailableModels([]);
    } finally {
        setIsLoadingModels(false);
    }
  }, []);

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

  useEffect(() => {
      fetchAvailableRepos();
      fetchGeminiConfig();
  }, [fetchAvailableRepos, fetchGeminiConfig]);

  const clearFileData = useCallback(() => {
    setAttachedFileContent(null);
    setAttachedFileName(null);
    setParsedRepomixData(null);
    setSelectedFilePath(null);
    setPromptSelectedFilePaths([]);
    setSelectedFileContent(null);
    if (!comparisonView) setIsFullScreenView(false);
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

  // Helper function to get all valid file paths from parsed data
  const getAllFilePathsFromParsedData = (data: ParsedRepomixData | null): string[] => {
    if (!data || !data.directoryStructure || !data.fileContents) return [];
    return data.directoryStructure.filter(p => data.fileContents.hasOwnProperty(p) && !p.endsWith('/'));
  };

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
    clearFileData(); // This will clear promptSelectedFilePaths
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
            // *** CHANGE: Select all files by default ***
            setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
        } else {
            setParsedRepomixData(null); // Ensure it's null if parsing fails
            setAttachmentStatus(`Attached ${filename} (non-standard format?).`);
            setPromptSelectedFilePaths([]); // Clear if no parsed data
        }
        attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 3000);
        return true;
    } catch (err: any) {
        setError(`Failed to load content for ${filename}: ${err.message}`);
        clearFileData(); // This will clear promptSelectedFilePaths
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
      clearFileData(); // This will clear promptSelectedFilePaths
      setSelectedRepoFile("");

      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          setAttachedFileContent(content);
          setAttachedFileName(file.name);
          const parsedData = parseRepomixFile(content);
          setParsedRepomixData(parsedData); // Set parsed data first
          setIsLoading(false);
          // *** CHANGE: Select all files by default ***
          if (parsedData) {
            setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
          } else {
            setPromptSelectedFilePaths([]); // Clear if no parsed data
          }
      };
      reader.onerror = (err) => {
          setError(`Error reading file: ${err}`);
          clearFileData(); // This will clear promptSelectedFilePaths
          setIsLoading(false);
      };
      reader.readAsText(file);
  }, [clearFileData, clearAttachmentStatus ]);

  const handleGenerateDescription = useCallback(async (
    generateRepoUrl: string, includePatterns: string, excludePatterns: string
  ) => {
    setIsGenerating(true);
    setGenerationMessage(null);
    setGenerationError(null);
    clearFileData(); // This will clear promptSelectedFilePaths
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
            // loadRepoFileContent will now handle setting promptSelectedFilePaths by default
            const loaded = await loadRepoFileContent(outputFilename);
            if (loaded) {
                setGenerationMessage(`Generated & Loaded: ${outputFilename}`);
                setSelectedRepoFile(outputFilename);
            } else {
                setGenerationError(`Generated ${outputFilename}, but failed to load/parse.`);
                setGenerationMessage(null);
            }
        }, 50); // Timeout to allow UI to update and fetchAvailableRepos to potentially finish
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

  const handlePromptSubmit = useCallback(async (prompt: string) => {
      if (!prompt && !attachedFileContent && promptSelectedFilePaths.length === 0) {
          setError("Please type a prompt, attach a file, or select files from the tree.");
          return;
      }
      setIsLoading(true);
      setError(null);
      setGenerationMessage(null);
      setGenerationError(null);
      clearAttachmentStatus();
      setCurrentCallStats(null);

      let filesToIncludeInPromptSegment = "";
      if (promptSelectedFilePaths.length > 0 && parsedRepomixData) {
          let selectedFilesContentParts: string[] = [];
          promptSelectedFilePaths.forEach(path => {
              const content = parsedRepomixData.fileContents[path];
              if (content) {
                  selectedFilesContentParts.push(`<file path="${path}">\n${content}\n</file>`);
              }
          });
          if (selectedFilesContentParts.length > 0) {
              filesToIncludeInPromptSegment = `<selected_repository_files>\n${selectedFilesContentParts.join('\n')}\n</selected_repository_files>`;
          }
      }

      let combinedPrompt = "";
      if (filesToIncludeInPromptSegment) {
          combinedPrompt += `Context from selected repository files:\n${filesToIncludeInPromptSegment}\n\n`;
      } else if (attachedFileContent) {
          combinedPrompt += `Attached File Content (${attachedFileName || 'full_description.md'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
      }
      combinedPrompt += prompt ? `User Prompt: ${prompt}` : `User Prompt: Please analyze the attached content.`;

      const userDisplayPrompt = prompt || (promptSelectedFilePaths.length > 0 ? `(Using ${promptSelectedFilePaths.length} selected files)` : `(Using attached file: ${attachedFileName})`);
      const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };

      const historyForBackend: ChatMessage[] = chatHistory
          .slice(-MAX_HISTORY_TURNS * 2)
          .map(msg => ({ role: msg.role, parts: msg.parts }));

      setChatHistory(prev => [...prev, newUserMessage]);

      try {
          const response = await fetch(`${prefix}/api/call-gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: historyForBackend,
                    newMessage: combinedPrompt,
                    systemPrompt: systemPrompt,
                    modelCallName: selectedModelCallName,
                }),
          });
          const result: GeminiApiResponse = await response.json();

          if (!response.ok || !result.success) {
              throw new Error(result.error || `API proxy error ${response.status}`);
          }
          const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text || "No text content received." }] };
          setChatHistory(prev => [...prev, newModelMessage]);

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
                modelUsed: prev.modelUsed
            }));
            if (result.modelUsed && result.modelUsed !== selectedModelCallName) {
                setSelectedModelCallName(result.modelUsed);
            }
          }
      } catch (apiError: any) {
          setError(`Error: ${apiError.message}`);
          setChatHistory(prev => prev.slice(0, -1));
      } finally {
          setIsLoading(false);
      }
  }, [chatHistory, attachedFileContent, attachedFileName, clearAttachmentStatus, systemPrompt, selectedModelCallName, promptSelectedFilePaths, parsedRepomixData]);

  const handleModelChange = (newModelCallName: string) => {
    setSelectedModelCallName(newModelCallName);
  };

  const handleTogglePromptSelectedFile = useCallback((filePath: string) => {
    setPromptSelectedFilePaths(prev =>
        prev.includes(filePath) ? prev.filter(p => p !== filePath) : [...prev, filePath]
    );
  }, []);
  
  // This useMemo correctly identifies all selectable files based on current parsedRepomixData
  const allFilePathsInCurrentRepomix = useMemo(() => getAllFilePathsFromParsedData(parsedRepomixData), [parsedRepomixData]);

  const handleSelectAllPromptFiles = useCallback(() => {
      setPromptSelectedFilePaths([...allFilePathsInCurrentRepomix]);
  }, [allFilePathsInCurrentRepomix]);

  const handleDeselectAllPromptFiles = useCallback(() => {
      setPromptSelectedFilePaths([]);
  }, []);

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
                    promptSelectedFilePaths={promptSelectedFilePaths}
                    onTogglePromptSelectedFile={handleTogglePromptSelectedFile}
                    onSelectAllPromptFiles={handleSelectAllPromptFiles}
                    onDeselectAllPromptFiles={handleDeselectAllPromptFiles}
                />
            )}

            <div className="center-column">
                <div className="scrollable-content-area">
                    <div className="top-controls-row">
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
                        </div>
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
                {(() => {
                    let displayAttachedFileName: string | null = attachedFileName;
                    if (promptSelectedFilePaths.length > 0) {
                        const allFilesCount = allFilePathsInCurrentRepomix.length;
                        if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                             displayAttachedFileName = `All ${allFilesCount} file(s) selected for prompt`;
                        } else {
                             displayAttachedFileName = `${promptSelectedFilePaths.length} file(s) selected for prompt`;
                        }
                    }
                    return (
                        <InputArea
                            onPromptSubmit={handlePromptSubmit}
                            onFileAttach={handleFileAttach}
                            isLoading={isLoading || isGenerating || isLoadingSelectedFile || isLoadingModels}
                            attachedFileName={displayAttachedFileName}
                        />
                    );
                })()}
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