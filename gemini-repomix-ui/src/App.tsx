// gemini-repomix-ui/src/App.tsx
import { useState, useCallback, useMemo, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector from './RepoSelector';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
import ModelSettings from './ModelSettings';
import './App.css';

// Import custom hooks
import { useSystemPrompt } from './hooks/useSystemPrompt';
import { useModels } from './hooks/useModels';
import { useRepomix } from './hooks/useRepomix';

import { useAuth } from './contexts/AuthContext'; // Import useAuth
import AuthForm from './AuthForm'; // Import AuthForm
import ApiKeyModal from './ApiKeyModal'; // Import the modal

// Import API service and types
import * as api from './services/api';

export interface ChatMessage {
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
    const [chatIsLoading, setChatIsLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    // --- New State for API Key Management ---
    const [userHasGeminiKey, setUserHasGeminiKey] = useState<boolean | null>(null); // null: unknown, true: has key, false: no key
    const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
    const [apiKeyStatusLoading, setApiKeyStatusLoading] = useState<boolean>(true); // Start true for initial check


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
        // updateGeminiConfig // if needed from useModels
    } = useModels("gemini-2.5-pro-preview-05-06");

    const {
        repoUrl,
        onRepoUrlChange,
        handleGenerateRepomixFile,
        isGenerating,
        generationMessage,
        generationError,
        availableRepos,
        isLoadingRepos,
        repoListError,
        selectedRepoFile,
        loadRepoFileContent,
        isLoadingFileContent,
        fileContentError,
        handleManualFileAttach,
        attachedFileName,
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

    // --- Effect for checking Gemini API Key status ---
    useEffect(() => {
        const checkApiKeyStatus = async () => {
            if (session && user && !authIsLoading) { // Only check if authenticated and auth isn't loading
                setApiKeyStatusLoading(true);
                // console.log('[App] Checking API key status...');
                const statusResult = await api.getGeminiApiKeyStatus();
                if (statusResult.success) {
                    setUserHasGeminiKey(statusResult.hasKey ?? false);
                    // console.log('[App] API key status:', statusResult.hasKey);
                    if (!statusResult.hasKey) {
                        setShowApiKeyModal(true); // Prompt user if no key
                    } else {
                        setShowApiKeyModal(false); // Ensure modal is closed if key exists
                    }
                } else {
                    console.error("[App] Failed to get API key status:", statusResult.error);
                    setChatError("Could not verify Gemini API key status. Chat features may be affected.");
                    setUserHasGeminiKey(false); // Assume no key on error to be safe
                    // setShowApiKeyModal(true); // Optionally prompt even on error to allow setting it
                }
                setApiKeyStatusLoading(false);
            } else if (!session && !authIsLoading) {
                 // If user logs out or session becomes invalid, reset key status
                 setUserHasGeminiKey(null);
                 setShowApiKeyModal(false);
                 setApiKeyStatusLoading(false); // No longer loading key status if no session
            }
            // If authIsLoading is true, we wait for it to resolve before checking.
        };
        checkApiKeyStatus();
    }, [session, user, authIsLoading]); // Re-check when session, user, or auth loading state changes

    const handleApiKeySubmitted = useCallback(() => {
        // Re-check status after submission
        if (session && user && !authIsLoading) {
            setApiKeyStatusLoading(true);
            api.getGeminiApiKeyStatus().then(statusResult => {
                if (statusResult.success) {
                    setUserHasGeminiKey(statusResult.hasKey ?? false);
                    if (statusResult.hasKey) {
                        setShowApiKeyModal(false); // Close modal if key is now present
                        setChatError(null); // Clear any previous API key related errors
                    }
                }
                setApiKeyStatusLoading(false);
            }).catch(err => {
                console.error("[App] Error re-checking API key status after submission:", err);
                setApiKeyStatusLoading(false);
            });
        }
    }, [session, user, authIsLoading]);


    useEffect(() => {
        if (!parsedRepomixData && !comparisonView) {
            setIsFullScreenView(false);
        }
    }, [parsedRepomixData, comparisonView]);

    const globalError = modelError || repoListError || fileContentError || chatError || generationError;

    const toggleFullScreenView = () => {
        if (parsedRepomixData || comparisonView) {
            setIsFullScreenView(prev => !prev);
        } else {
            setIsFullScreenView(false);
        }
    };

    const handleStartComparison = (filePath: string, suggestedContent: string) => {
        if (parsedRepomixData?.fileContents[filePath]) {
            setComparisonView({ filePath, originalContent: parsedRepomixData.fileContents[filePath], suggestedContent });
            setIsFullScreenView(true);
        } else {
            setChatError(`Original content for ${filePath} not found for comparison.`);
        }
    };
    const handleCloseComparison = () => setComparisonView(null);


    const handlePromptSubmit = useCallback(async (prompt: string) => {
        if (userHasGeminiKey === false) { // Explicitly check for false
            setChatError("Gemini API Key is not set. Please set your API key to use chat features.");
            setShowApiKeyModal(true);
            return;
        }
        if (userHasGeminiKey === null && !apiKeyStatusLoading) { // If still unknown and not loading, implies an issue
            setChatError("Could not verify API key status. Please try again or set your key.");
            setShowApiKeyModal(true); // Prompt to set it
            return;
        }

        if (!prompt && !parsedRepomixData && promptSelectedFilePaths.length === 0) {
            setChatError("Please type a prompt, attach a file, or select files from the tree.");
            return;
        }
        setChatIsLoading(true);
        setChatError(null);
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
        let contextContent = "";
        let contextDescriptor = "";

        if (filesToIncludeInPromptSegment) {
            contextContent = filesToIncludeInPromptSegment;
            contextDescriptor = `(Using ${promptSelectedFilePaths.length} selected files)`;
        } else if (parsedRepomixData) {
            contextDescriptor = attachedFileName ? `(Context: ${attachedFileName})` : "(General context)";
        } else if (attachedFileName) {
            contextDescriptor = `(Regarding file: ${attachedFileName})`;
        }

        let combinedPromptForApi = "";
        if (contextContent) {
            combinedPromptForApi += `Context from selected repository files:\n${contextContent}\n\n`;
        }
        combinedPromptForApi += prompt ? `User Prompt: ${prompt}` : (contextDescriptor ? `User Prompt: Please analyze the ${contextDescriptor}.` : `User Prompt: Please analyze.`);

        const userDisplayPrompt = prompt || contextDescriptor || "Analyze request";
        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };
        const historyForBackend: ChatMessage[] = chatHistory.slice(-MAX_HISTORY_TURNS * 2).map(msg => ({ role: msg.role, parts: msg.parts }));
        setChatHistory(prev => [...prev, newUserMessage]);

        const result = await api.callGemini({
            history: historyForBackend,
            newMessage: combinedPromptForApi,
            systemPrompt: systemPrompt,
            modelCallName: selectedModelCallName,
        });

        if (result.success && result.text) {
            const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: result.text }] };
            setChatHistory(prev => [...prev, newModelMessage]);
            if (result.inputTokens !== undefined && result.outputTokens !== undefined && result.totalCost !== undefined) {
                recordCallStats({
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
            const errorMessage = result.error || "Gemini API call failed.";
            setChatError(`Error: ${errorMessage}`);
            if (errorMessage.toLowerCase().includes("api key") || errorMessage.toLowerCase().includes("permission_denied") || result.error?.includes("402")) {
                setUserHasGeminiKey(false);
                setShowApiKeyModal(true);
            }
            setChatHistory(prev => prev.slice(0, -1));
        }
        setChatIsLoading(false);

    }, [
        chatHistory, systemPrompt, selectedModelCallName, recordCallStats, resetCurrentCallStats,
        parsedRepomixData, promptSelectedFilePaths, attachedFileName,
        userHasGeminiKey, apiKeyStatusLoading // Add dependencies
    ]);


    const displayAttachedFileNameForInputArea = useMemo(() => {
        if (promptSelectedFilePaths.length > 0) {
            const allFilesCount = allFilePathsInCurrentRepomix.length;
            if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                 return `All ${allFilesCount} file(s) selected for prompt`;
            } else {
                 return `${promptSelectedFilePaths.length} file(s) selected for prompt`;
            }
        }
        return attachedFileName;
    }, [promptSelectedFilePaths, allFilePathsInCurrentRepomix, attachedFileName]);

    const anyLoading = chatIsLoading || isGenerating || isLoadingFileContent || isLoadingModels ||
                       isLoadingSelectedFileForView || isLoadingRepos || isSystemPromptSaving || apiKeyStatusLoading;

    if (authIsLoading || (session && apiKeyStatusLoading && userHasGeminiKey === null) ) { // Show loading if auth is loading OR if session exists but API key status is still being checked
        return <div className="app-container" style={{ textAlign: 'center', paddingTop: '50px' }}>Loading application essentials...</div>;
    }

    if (!session || !user) {
        return <AuthForm />;
    }

    return (
    <div className={`app-container ${isFullScreenView ? 'full-screen-file-view' : ''}`}>
        <ApiKeyModal
            isOpen={showApiKeyModal && userHasGeminiKey === false && !apiKeyStatusLoading} // Only open if we know there's no key and not currently checking
            onClose={() => setShowApiKeyModal(false)}
            onKeySubmitted={handleApiKeySubmitted}
        />
        {/* --- MODIFIED HEADER with Flexbox layout --- */}
        <header className="app-header">
            <h1 className="app-title">Gemini Repomix Assistant</h1>
            
            <div className="header-actions-right"> 
                {userHasGeminiKey === false && !apiKeyStatusLoading && (
                    <button
                        onClick={() => setShowApiKeyModal(true)}
                        className="header-action-button api-key-warning-button" 
                        title="Set your Gemini API Key"
                    >
                        ⚠️ Set API Key
                    </button>
                )}
                {user && user.email && <span className="user-email-display">{user.email}</span>}
                {user && (
                    <button onClick={signOut} className="header-action-button logout-button">Logout</button>
                )}
                {(parsedRepomixData || comparisonView) && (
                    <button
                        onClick={toggleFullScreenView}
                        className="header-action-button fullscreen-toggle-button" 
                        title={isFullScreenView ? "Exit Full Screen View" : "Expand File View"}
                        disabled={anyLoading && isFullScreenView} // Optionally disable if loading
                    >
                        {isFullScreenView ? '📰 Collapse' : '↔️ Expand'}
                    </button>
                )}
            </div>
        </header>
        {/* --- END OF MODIFIED HEADER --- */}

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
                    {userHasGeminiKey === false && !apiKeyStatusLoading && ( // Show only if we know there's no key
                        <div className="error-message" style={{textAlign: 'center', marginBottom: '1rem', padding: '10px'}}>
                            Gemini API Key is not set. Chat functionality is disabled.
                            <button onClick={() => setShowApiKeyModal(true)} style={{marginLeft: '10px', padding: '5px 10px', cursor: 'pointer'}}>Set Key</button>
                        </div>
                    )}
                    <div className="top-controls-row">
                        <div className="top-controls-left">
                            <RepomixForm
                                repoUrl={repoUrl}
                                onRepoUrlChange={onRepoUrlChange}
                                onGenerate={handleGenerateRepomixFile}
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
                                    disabled={isSystemPromptSaving}
                                >
                                    {showSystemPromptInput ? 'Hide' : 'Set'} System Prompt (File)
                                </button>
                                {showSystemPromptInput && (
                                    <div className="system-prompt-input-area">
                                        <textarea
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                            rows={3}
                                            className="system-prompt-textarea"
                                            disabled={isSystemPromptSaving}
                                        />
                                        <button
                                            onClick={handleSaveSystemPrompt}
                                            disabled={isSystemPromptSaving || !systemPrompt?.trim()}
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
                                isChatLoading={chatIsLoading}
                            />
                        </div>
                    </div>

                    {attachmentStatus && (
                        <div className={`attachment-status ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') ? 'warning' : 'success'}`}>
                            {attachmentStatus}
                        </div>
                    )}

                    {globalError && <div className="error-message main-error">{globalError}</div>}

                    <ChatInterface
                        history={chatHistory}
                        onStartComparison={handleStartComparison}
                        parsedRepomixData={parsedRepomixData}
                    />
                    {chatIsLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                        <div className="loading-indicator">Thinking...</div>
                    )}
                </div>
                <InputArea
                    onPromptSubmit={handlePromptSubmit}
                    onFileAttach={handleManualFileAttach}
                    isLoading={anyLoading || (userHasGeminiKey === false && !apiKeyStatusLoading)} // Also disable input if we know key is missing and not checking
                    attachedFileName={displayAttachedFileNameForInputArea}
                />
            </div>

            {(parsedRepomixData || comparisonView) && isFullScreenView && (
                <FileContentDisplay
                    filePath={selectedFilePathForView}
                    content={selectedFileContentForView}
                    isLoading={isLoadingSelectedFileForView && !comparisonView}
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