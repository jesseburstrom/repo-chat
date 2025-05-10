// gemini-repomix-ui/src/App.tsx
import { useState, useCallback, useMemo, useEffect } from 'react'; // Removed useRef where hook manages it
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector /*, { RepoInfo } // RepoInfo now internal to useRepomix hook or api.ts */ from './RepoSelector';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
// import { parseRepomixFile, ParsedRepomixData } from './utils/parseRepomix'; // ParsedRepomixData still needed
import ModelSettings /*, { ClientGeminiModelInfo, TokenStats } // Types now internal to useModels or api.ts */ from './ModelSettings';
import './App.css';

// Import custom hooks
import { useSystemPrompt } from './hooks/useSystemPrompt';
import { useModels } from './hooks/useModels';
import { useRepomix } from './hooks/useRepomix';

import { useAuth } from './contexts/AuthContext'; // Import useAuth
import AuthForm from './AuthForm'; // Import AuthForm

// Import API service and types
import * as api from './services/api'; // Import all as api
//import type { GeminiApiResponse } from './services/api'; // Explicitly import if needed for type casting
//import type { ParsedRepomixData } from './utils/parseRepomix'; // Keep if used for prop types

export interface ChatMessage { // Keep this if it's fundamental to App's role as orchestrator
  role: "user" | "model";
  parts: [{ text: string }];
}

interface ComparisonViewData {
    filePath: string;
    originalContent: string;
    suggestedContent: string;
}

const MAX_HISTORY_TURNS = 10;

function App() {
    const { session, user, signOut, isLoading: authIsLoading } = useAuth();
    // --- UI State ---
    const [comparisonView, setComparisonView] = useState<ComparisonViewData | null>(null);
    const [isFullScreenView, setIsFullScreenView] = useState(false);
    const [chatIsLoading, setChatIsLoading] = useState(false); // Chat specific loading
    const [chatError, setChatError] = useState<string | null>(null); // Chat specific error

    // --- Custom Hooks ---
    const {
        systemPrompt,
        setSystemPrompt,
        showSystemPromptInput,
        setShowSystemPromptInput,
        isSystemPromptSaving,
        systemPromptMessage,
        handleSaveSystemPrompt,
    } = useSystemPrompt();

    const {
        availableModels,
        selectedModelCallName,
        isLoadingModels,
        modelError,
        handleModelChange,
        currentCallStats,
        totalSessionStats,
        recordCallStats,
        resetCurrentCallStats,
    } = useModels("gemini-2.5-pro-preview-05-06" /* Default model if needed */);

    const {
        repoUrl,
        onRepoUrlChange,
        // includePatterns, // Defaulted in hook for now
        // excludePatterns, // Defaulted in hook for now
        handleGenerateRepomixFile,
        isGenerating, // Renamed from repomixIsGenerating for clarity
        generationMessage,
        generationError,
        availableRepos,
        isLoadingRepos,
        repoListError,
        selectedRepoFile,
        loadRepoFileContent,
        isLoadingFileContent,
        fileContentError, // Error specific to loading .md content
        handleManualFileAttach,
        attachedFileName, // This is the name of the .md or manually uploaded file
        parsedRepomixData,
        selectedFilePathForView,
        selectedFileContentForView,
        isLoadingSelectedFileForView,
        handleSelectFileForViewing,
        promptSelectedFilePaths,
        handleTogglePromptSelectedFile,
        handleSelectAllPromptFiles,
        handleDeselectAllPromptFiles,
        allFilePathsInCurrentRepomix,
        attachmentStatus
    } = useRepomix();

    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    // --- Effects for UI state based on hook states ---
    useEffect(() => {
        if (!parsedRepomixData && !comparisonView) {
            setIsFullScreenView(false);
        }
    }, [parsedRepomixData, comparisonView]);
    
    // --- Combined Error Display (example) ---
    // You might want more granular error displays, but this shows combining them
    const globalError = modelError || repoListError || fileContentError || chatError || generationError;


    // --- Event Handlers that orchestrate between hooks/UI ---
    const toggleFullScreenView = () => {
        if (parsedRepomixData || comparisonView) {
            setIsFullScreenView(prev => !prev);
        } else {
            setIsFullScreenView(false); // Should not be possible if button not shown
        }
    };

    const handleStartComparison = (filePath: string, suggestedContent: string) => {
        if (parsedRepomixData?.fileContents[filePath]) {
            setComparisonView({ filePath, originalContent: parsedRepomixData.fileContents[filePath], suggestedContent });
            // handleSelectFileForViewing(null); // Clear single file view if any
            setIsFullScreenView(true);
        } else {
            setChatError(`Original content for ${filePath} not found for comparison.`); // Use chat error for now
        }
    };
    const handleCloseComparison = () => {
        setComparisonView(null);
        // Decide if you want to clear selectedFilePathForView or restore it
    };


    const handlePromptSubmit = useCallback(async (prompt: string) => {
        if (!prompt && !parsedRepomixData && promptSelectedFilePaths.length === 0) {
            setChatError("Please type a prompt, attach a file, or select files from the tree.");
            return;
        }
        setChatIsLoading(true);
        setChatError(null);
        // clearAttachmentStatus(); // Managed by useRepomix if needed
        resetCurrentCallStats();

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

        // Determine the base content for the prompt (either selected files or the whole attached .md content)
        // The `attachedFileContent` from `useRepomix` is the *entire* .md file.
        // We prioritize `filesToIncludeInPromptSegment` if specific files are chosen.
        let contextContent = "";
        let contextDescriptor = "";

        if (filesToIncludeInPromptSegment) {
            contextContent = filesToIncludeInPromptSegment;
            contextDescriptor = `(Using ${promptSelectedFilePaths.length} selected files)`;
        } else if (parsedRepomixData) { // If parsedData exists but no specific files selected, imply using the whole thing
            // This case needs careful thought: do we send the whole `attachedFileContent` (the .md file)
            // or imply its context without re-sending?
            // For now, let's assume if parsedData is there and no files selected, no *explicit* file content is sent,
            // relying on the model to remember previous context if Repomix file was just loaded.
            // This behavior might need adjustment based on desired UX.
            // If you *always* want to send the full .md content if no sub-files are selected, uncomment below.
            /*
            if (attachedFileContent) { // `attachedFileContent` is the content of the .md file
                contextContent = `Attached File Content (${attachedFileName || 'full_description.md'}):\n\`\`\`\n${attachedFileContent}\n\`\`\`\n\n`;
                contextDescriptor = `(Using attached file: ${attachedFileName})`;
            }
            */
             contextDescriptor = attachedFileName ? `(Context: ${attachedFileName})` : "(General context)";

        } else if (attachedFileName) { // Manually attached file, not parsed by Repomix
             // This case might be redundant if `handleManualFileAttach` sets `parsedRepomixData` to a basic structure
             // For now, let's assume this implies a non-Repomix text file.
            // We'd need the actual content of this manually attached file.
            // `useRepomix` doesn't expose `attachedFileContent` directly, it uses it to produce `parsedRepomixData`.
            // This part of logic needs review based on how `handleManualFileAttach` interacts with `parsedRepomixData`.
            // Let's assume for now, if `parsedRepomixData` is null but `attachedFileName` exists, it was a non-parsable file.
            // We probably shouldn't send its content automatically unless explicitly told.
            contextDescriptor = `(Regarding file: ${attachedFileName})`;
        }


        let combinedPromptForApi = "";
        if (contextContent) { // Only add if we have specific file segments
            combinedPromptForApi += `Context from selected repository files:\n${contextContent}\n\n`;
        }
        combinedPromptForApi += prompt ? `User Prompt: ${prompt}` : (contextDescriptor ? `User Prompt: Please analyze the ${contextDescriptor}.` : `User Prompt: Please analyze.`);


        const userDisplayPrompt = prompt || contextDescriptor || "Analyze request";
        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };

        const historyForBackend: ChatMessage[] = chatHistory
            .slice(-MAX_HISTORY_TURNS * 2) // Ensure we don't send too much history
            .map(msg => ({ role: msg.role, parts: msg.parts }));

        setChatHistory(prev => [...prev, newUserMessage]);

        const result = await api.callGemini({
            history: historyForBackend,
            newMessage: combinedPromptForApi,
            systemPrompt: systemPrompt, // From useSystemPrompt
            modelCallName: selectedModelCallName, // From useModels
        });

        if (result.success && result.text) {
            const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text }] };
            setChatHistory(prev => [...prev, newModelMessage]);

            if (result.inputTokens !== undefined && result.outputTokens !== undefined && result.totalCost !== undefined) {
                recordCallStats({ // From useModels
                    inputTokens: result.inputTokens,
                    outputTokens: result.outputTokens,
                    totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
                    inputCost: result.inputCost || 0,
                    outputCost: result.outputCost || 0,
                    totalCost: result.totalCost || 0,
                    modelUsed: result.modelUsed || selectedModelCallName,
                });
            }
        } else {
            setChatError(`Error: ${result.error || "Gemini API call failed."}`);
            setChatHistory(prev => prev.slice(0, -1)); // Remove the optimistic user message
        }
        setChatIsLoading(false);

    }, [
        chatHistory, systemPrompt, selectedModelCallName, recordCallStats, resetCurrentCallStats,
        parsedRepomixData, promptSelectedFilePaths, attachedFileName // From useRepomix
    ]);


    // --- Derived State for UI ---
    const displayAttachedFileNameForInputArea = useMemo(() => {
        if (promptSelectedFilePaths.length > 0) {
            const allFilesCount = allFilePathsInCurrentRepomix.length;
            if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                 return `All ${allFilesCount} file(s) selected for prompt`;
            } else {
                 return `${promptSelectedFilePaths.length} file(s) selected for prompt`;
            }
        }
        return attachedFileName; // This is the name of the .md file or manually uploaded one
    }, [promptSelectedFilePaths, allFilePathsInCurrentRepomix, attachedFileName]);

    const anyLoading = chatIsLoading || isGenerating || isLoadingFileContent || isLoadingModels || isLoadingSelectedFileForView || isLoadingRepos || isSystemPromptSaving;

    // If auth is loading, show a loading indicator
    if (authIsLoading) {
        return <div className="app-container" style={{textAlign: 'center', paddingTop: '50px'}}>Loading authentication...</div>;
    }

    // If no session, show the AuthForm
    if (!session || !user) {
        return <AuthForm />;
    }

    return (
    <div className={`app-container ${isFullScreenView ? 'full-screen-file-view' : ''}`}>
        <header className="app-header">
            {/* Modified Header Section for Auth Info and Logout */}
                        <h1>Gemini Repomix Assistant</h1>
            {user && (
                <div className="user-info-logout-container">
                    {user.email && <span className="user-email-display">Logged in as: {user.email}</span>}
                    <button onClick={signOut} className="logout-button">Logout</button>
                </div>
            )}
            {/* End of Modified Header Section */}

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
                    selectedFilePath={selectedFilePathForView}
                    onSelectFile={handleSelectFileForViewing}
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
                                repoUrl={repoUrl} // from useRepomix
                                onRepoUrlChange={onRepoUrlChange} // from useRepomix
                                // Pass default include/exclude or manage them in useRepomix if they need to be dynamic
                                onGenerate={handleGenerateRepomixFile} // from useRepomix
                                isGenerating={isGenerating} // from useRepomix
                                generationMessage={generationMessage} // from useRepomix
                                generationError={generationError} // from useRepomix
                            />
                            <RepoSelector
                                repos={availableRepos} // from useRepomix
                                onSelectRepo={loadRepoFileContent} // from useRepomix
                                isLoading={isLoadingRepos || isLoadingFileContent} // from useRepomix
                                selectedValue={selectedRepoFile} // from useRepomix
                            />
                            <div className="system-prompt-settings-group">
                                <button
                                    onClick={() => setShowSystemPromptInput(prev => !prev)}
                                    className="toggle-system-prompt-button"
                                    disabled={isSystemPromptSaving}
                                >
                                    {showSystemPromptInput ? 'Hide' : 'Set'} System Prompt (File)
                                </button>
                                {showSystemPromptInput && (
                                    <div className="system-prompt-input-area">
                                        <textarea
                                            value={systemPrompt} // from useSystemPrompt
                                            onChange={(e) => setSystemPrompt(e.target.value)} // from useSystemPrompt
                                            rows={3}
                                            className="system-prompt-textarea"
                                            disabled={isSystemPromptSaving} // from useSystemPrompt
                                        />
                                        <button
                                            onClick={handleSaveSystemPrompt} // from useSystemPrompt
                                            disabled={isSystemPromptSaving || (systemPrompt !== null && !systemPrompt.trim())} // Added null check for systemPrompt
                                            className="save-system-prompt-button"
                                        >
                                            {isSystemPromptSaving ? 'Saving...' : 'Save to File'}
                                        </button>
                                        {systemPromptMessage && ( /* from useSystemPrompt */
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
                                availableModels={availableModels} // from useModels
                                selectedModelCallName={selectedModelCallName} // from useModels
                                onModelChange={handleModelChange} // from useModels
                                isLoadingModels={isLoadingModels} // from useModels
                                currentCallStats={currentCallStats} // from useModels
                                totalSessionStats={totalSessionStats} // from useModels
                                isChatLoading={chatIsLoading} // App specific
                            />
                        </div>
                    </div>
                    
                    {attachmentStatus && ( // from useRepomix
                        <div className={`attachment-status ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') ? 'warning' : 'success'}`}>
                            {attachmentStatus}
                        </div>
                    )}

                    {globalError && <div className="error-message main-error">{globalError}</div>}
                    
                    <ChatInterface
                        history={chatHistory}
                        onStartComparison={handleStartComparison}
                        parsedRepomixData={parsedRepomixData} // from useRepomix
                    />
                    {chatIsLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                        <div className="loading-indicator">Thinking...</div>
                    )}
                    {/* Chat specific error is part of globalError now, or display separately if preferred */}

                </div>
                <InputArea
                    onPromptSubmit={handlePromptSubmit}
                    onFileAttach={handleManualFileAttach} // from useRepomix
                    isLoading={anyLoading}
                    attachedFileName={displayAttachedFileNameForInputArea}
                />
            </div>

            {(parsedRepomixData || comparisonView) && isFullScreenView && (
                <FileContentDisplay
                    filePath={selectedFilePathForView} // from useRepomix
                    content={selectedFileContentForView} // from useRepomix
                    isLoading={isLoadingSelectedFileForView && !comparisonView} // from useRepomix
                    comparisonData={comparisonView} // App specific UI state
                    onCloseComparison={handleCloseComparison} // App specific UI state
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