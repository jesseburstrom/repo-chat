// gemini-repomix-ui/src/App.tsx
import { useState, useCallback, useMemo, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector from './RepoSelector';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
import ModelSettings from './ModelSettings';

// Import custom hooks & contexts
import { useSystemPrompt } from './hooks/useSystemPrompt';
import { useModels } from './hooks/useModels';
import { useAuth } from './contexts/AuthContext';
import { useRepomixContext } from './contexts/RepomixContext'; // Import context hook

import AuthForm from './AuthForm';
import ApiKeyModal from './ApiKeyModal';

// Import API service and types
import * as api from './services/api'; // Keep for API key status, callGemini

export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

interface ComparisonViewData {
    filePath: string;
    originalContent: string;
    suggestedContent: string;
}

const MAX_HISTORY_TURNS = 10; // Max turns of history (user + model = 1 turn) sent to API

function App() {
    const { session, user, signOut, isLoading: authIsLoading } = useAuth();
    const {
        availableRepos, selectedRepoFile, parsedRepomixData, isLoading: repomixIsLoading,
        error: repomixError, attachmentStatus, selectedFilePathForView,
        selectedFileContentForView, promptSelectedFilePaths, allFilePathsInCurrentRepomix,
        generateRepomixFile, loadRepoFileContent, handleManualFileAttach,
        selectFileForViewing, togglePromptSelectedFile, selectAllPromptFiles, deselectAllPromptFiles,
        clearCurrentRepomixData,
        deleteRepomixFile, // Get from context
        
    } = useRepomixContext();

    // --- UI State ---
    const [comparisonView, setComparisonView] = useState<ComparisonViewData | null>(null);
    const [isFullScreenView, setIsFullScreenView] = useState(false);
    const [chatIsLoading, setChatIsLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    // --- API Key State ---
    const [userHasGeminiKey, setUserHasGeminiKey] = useState<boolean | null>(null);
    const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
    const [apiKeyStatusLoading, setApiKeyStatusLoading] = useState<boolean>(true);

    // --- Custom Hooks for other features ---
    const {
        systemPrompt, setSystemPrompt, showSystemPromptInput, setShowSystemPromptInput,
        isLoadingPrompt, isSystemPromptSaving, systemPromptMessage, handleSaveSystemPrompt,
    } = useSystemPrompt();

    const {
        availableModels, selectedModelCallName, isLoadingModels, modelError,
        handleModelChange, currentCallStats, totalSessionStats, recordCallStats,
        resetCurrentCallStats, updateGeminiConfig
    } = useModels();


    // --- Effect for checking Gemini API Key status ---
    useEffect(() => {
        const checkApiKeyStatus = async () => {
            if (session && user && !authIsLoading) {
                setApiKeyStatusLoading(true);
                const statusResult = await api.getGeminiApiKeyStatus();
                if (statusResult.success) {
                    setUserHasGeminiKey(statusResult.hasKey ?? false);
                    if (!statusResult.hasKey) {
                        setShowApiKeyModal(true);
                    } else {
                        setShowApiKeyModal(false);
                    }
                } else {
                    console.error("[App] Failed to get API key status:", statusResult.error);
                    setChatError("Could not verify Gemini API key status."); // Show error to user
                    setUserHasGeminiKey(false); // Assume no key on error
                }
                setApiKeyStatusLoading(false);
            } else if (!session && !authIsLoading) { // If no session and auth is done
                 setUserHasGeminiKey(null);
                 setShowApiKeyModal(false);
                 setApiKeyStatusLoading(false);
            }
        };
        checkApiKeyStatus();
    }, [session, user, authIsLoading]); // Re-check when session/auth state changes

    // --- Callback for API Key Modal ---
    const handleApiKeySubmitted = useCallback(() => {
        if (session && user && !authIsLoading) { // Ensure user and session exist
            setApiKeyStatusLoading(true);
            api.getGeminiApiKeyStatus().then(statusResult => {
                if (statusResult.success) {
                    setUserHasGeminiKey(statusResult.hasKey ?? false);
                    if (statusResult.hasKey) {
                        setShowApiKeyModal(false);
                        setChatError(null); // Clear previous errors
                        updateGeminiConfig(); // Refresh model config as key might enable new models
                    }
                } else {
                     console.error("[App] Error re-checking API key status after submission:", statusResult.error);
                     // Potentially set an error message for the user here
                }
                setApiKeyStatusLoading(false);
            }).catch(err => {
                console.error("[App] Exception re-checking API key status after submission:", err);
                setApiKeyStatusLoading(false);
            });
        }
    }, [session, user, authIsLoading, updateGeminiConfig]);

    // --- Effect to manage Fullscreen state ---
    useEffect(() => {
        if (!parsedRepomixData && !comparisonView) {
            setIsFullScreenView(false);
        }
    }, [parsedRepomixData, comparisonView]);


    // --- Global Error Aggregation ---
    const globalError = modelError || repomixError || chatError;

    // --- Toggle Fullscreen ---
    const toggleFullScreenView = () => {
        if (parsedRepomixData || comparisonView) {
            setIsFullScreenView(prev => !prev);
        } else {
            setIsFullScreenView(false); // Ensure it's false if no data
        }
    };

    // --- Comparison View Handlers ---
    const handleStartComparison = (filePath: string, suggestedContent: string) => {
        if (parsedRepomixData?.fileContents[filePath]) {
            setComparisonView({ filePath, originalContent: parsedRepomixData.fileContents[filePath], suggestedContent });
            setIsFullScreenView(true); // Auto-enter fullscreen for comparison
        } else {
            setChatError(`Original content for ${filePath} not found for comparison.`);
        }
    };
    const handleCloseComparison = () => setComparisonView(null);

    // --- Prompt Submission Logic ---
    const handlePromptSubmit = useCallback(async (prompt: string) => {
        if (userHasGeminiKey === false) {
            setChatError("Gemini API Key is not set. Please set your API key.");
            setShowApiKeyModal(true); return;
        }
        if (userHasGeminiKey === null && !apiKeyStatusLoading) { // Status check failed or pending
            setChatError("Could not verify API key status. Please try again or set your key.");
            setShowApiKeyModal(true); return;
        }

        const currentAttachedFileName = parsedRepomixData && selectedRepoFile ? selectedRepoFile : null;

        if (!prompt.trim() && !parsedRepomixData && promptSelectedFilePaths.length === 0) {
            setChatError("Please type a prompt, attach a file, or select files from the tree.");
            return;
        }

        setChatIsLoading(true);
        setChatError(null);
        resetCurrentCallStats();

        let filesToIncludeInPromptSegment = "";
        if (promptSelectedFilePaths.length > 0 && parsedRepomixData?.fileContents) {
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

        let contextDescriptor = "";
        if (filesToIncludeInPromptSegment) {
            contextDescriptor = `(Using ${promptSelectedFilePaths.length} selected files)`;
        } else if (parsedRepomixData && currentAttachedFileName) {
            contextDescriptor = `(Context: ${currentAttachedFileName})`;
        } else if (currentAttachedFileName) { // Manually attached file, parsedRepomixData might be null
             contextDescriptor = `(Regarding file: ${currentAttachedFileName})`;
        }


        let combinedPromptForApi = "";
        if (filesToIncludeInPromptSegment) {
            combinedPromptForApi += `Context from selected repository files:\n${filesToIncludeInPromptSegment}\n\n`;
        }
        combinedPromptForApi += prompt ? `User Prompt: ${prompt}` : (contextDescriptor ? `User Prompt: Please analyze the ${contextDescriptor}.` : `User Prompt: Please analyze.`);

        const userDisplayPrompt = prompt || contextDescriptor || "Analyze request";
        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: userDisplayPrompt }] };

        // Prepare history for backend (limit turns)
        const historyForBackend: ChatMessage[] = chatHistory.slice(-MAX_HISTORY_TURNS * 2).map(msg => ({ role: msg.role, parts: msg.parts }));
        setChatHistory(prev => [...prev, newUserMessage]);

        const result = await api.callGemini({
            history: historyForBackend,
            newMessage: combinedPromptForApi,
            // systemPrompt is now handled by backend using user's stored preference
            modelCallName: selectedModelCallName, // User's current UI selection
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
            // If API key related error, trigger modal
            if (errorMessage.toLowerCase().includes("api key") || errorMessage.toLowerCase().includes("permission_denied") || result.error?.includes("402") || result.error?.includes("403")) {
                setUserHasGeminiKey(false); // Assume key is invalid or missing
                setShowApiKeyModal(true);
            }
            setChatHistory(prev => prev.slice(0, -1)); // Remove the user's pending message
        }
        setChatIsLoading(false);

    }, [
        chatHistory, selectedModelCallName, recordCallStats, resetCurrentCallStats,
        parsedRepomixData, promptSelectedFilePaths, selectedRepoFile,
        userHasGeminiKey, apiKeyStatusLoading
    ]);

    // --- Memoized display filename ---
    const displayAttachedFileNameForInputArea = useMemo(() => {
        if (promptSelectedFilePaths.length > 0) {
            const allFilesCount = allFilePathsInCurrentRepomix.length;
            if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                 return `All ${allFilesCount} file(s) selected for prompt`;
            } else {
                 return `${promptSelectedFilePaths.length} file(s) selected for prompt`;
            }
        }
        // If a repo file is selected from dropdown and parsed
        if (selectedRepoFile && parsedRepomixData) {
            return selectedRepoFile;
        }
        // If a file was manually attached and parsed
        if (!selectedRepoFile && parsedRepomixData && attachmentStatus?.startsWith("Attached & Parsed")) {
             // Try to extract a name; this logic might need refinement based on how manual attach sets names
            return attachmentStatus.replace("Attached & Parsed ", "").replace(" successfully.", "") || "Manually attached file";
        }
        return null; // No specific file or selection for display
    }, [promptSelectedFilePaths, allFilePathsInCurrentRepomix, selectedRepoFile, parsedRepomixData, attachmentStatus]);


    // --- Combined Loading State ---
    const anyLoading = chatIsLoading || repomixIsLoading || isLoadingModels ||
                       isLoadingPrompt || isSystemPromptSaving || apiKeyStatusLoading;

    // --- SignOut Handler ---
    const handleSignOut = async () => {
        await signOut();
        // Clear local states that might persist across users if not careful
        setChatHistory([]);
        setSystemPrompt(''); // Reset system prompt from hook if not auto-reset by hook on auth change
        clearCurrentRepomixData(); // Clear repomix context data
        // Other state resets as needed
    };


    // --- Loading/Auth Checks ---
    if (authIsLoading || (session && apiKeyStatusLoading && userHasGeminiKey === null) ) {
        return <div className="flex justify-center items-center h-screen text-center text-lg">Loading application essentials...</div>;
    }
    if (!session || !user) {
        return <AuthForm />;
    }

    // --- Tailwind Class Definitions ---
    const appContainerBaseClasses = "flex flex-col h-screen bg-white border border-[#e7eaf3] overflow-hidden";
    const appContainerNormalClasses = "w-[80%] mx-auto my-[30px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08),_0_1px_3px_rgba(0,0,0,0.05)] h-[calc(100vh_-_60px)]"; // Added my-[30px] and adjusted height
    const appContainerFullscreenClasses = "w-full max-w-none m-0 border-none rounded-none shadow-none h-screen"; // Full height for fullscreen

    const mainContentWrapperBaseClasses = "flex flex-row flex-grow overflow-hidden";
    // Adjusted height calculation for normal view to account for header/footer and potential margins
    const mainContentWrapperHeight = "h-[calc(100%_-_70px_-_45px)]"; // 100% of parent - header - footer
    const fullscreenMainContentHeight = "h-[calc(100vh_-_70px_-_0px)]"; // Fullscreen, no footer visible perhaps, or footer is overlayed or context-dependent


    const fileTreeFullscreenClasses = "w-[22%] max-w-[450px] h-full flex-shrink-0";
    const centerColumnFullscreenClasses = "flex-1 h-full flex flex-col overflow-hidden border-l border-r border-[#e7eaf3]";
    const fileContentPanelFullscreenClasses = "flex-1 h-full overflow-hidden border-l border-[#e7eaf3]";
    const chatColumnForComparisonViewClasses = "flex-1 h-full flex flex-col overflow-hidden border-r border-[#e7eaf3]";
    const comparisonPanelForComparisonViewClasses = "flex-[2_1_0%] h-full overflow-hidden";

    const headerActionButtonBaseClasses = "px-3 py-[6px] text-sm rounded-md cursor-pointer border border-[#d9dce3] bg-[#f0f2f5] text-[#333] transition-colors duration-200 ease-in-out leading-snug hover:enabled:bg-[#e7eaf3] hover:enabled:border-[#c8cdd8] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";
    const controlPanelBaseClasses = "px-6 py-5 border border-[#e0e6ed] rounded-lg bg-white shadow-sm";
    const statusMessageBaseClasses = "px-[15px] py-[10px] mt-[10px] rounded-md text-sm border";
    const statusMessageSuccessClasses = "bg-[#e8f8f5] text-[#1abc9c] border-[#a3e4d7]";
    const statusMessageWarningClasses = "bg-[#fdebd0] text-[#e67e22] border-[#f5cba7]";
    const statusMessageErrorClasses = "bg-[#fdedec] text-[#e74c3c] border-[#f5b7b1]";

    return (
        <div className={`${appContainerBaseClasses} ${isFullScreenView ? appContainerFullscreenClasses : appContainerNormalClasses}`}>
            <ApiKeyModal
                isOpen={showApiKeyModal && userHasGeminiKey === false && !apiKeyStatusLoading}
                onClose={() => setShowApiKeyModal(false)}
                onKeySubmitted={handleApiKeySubmitted}
            />

            <header className="flex items-center justify-between px-[30px] h-[70px] border-b border-[#e7eaf3] bg-white flex-shrink-0">
                <h1 className="text-2xl font-semibold text-[#2c3e50] m-0">
                    Gemini Repomix Assistant
                </h1>
                <div className="flex items-center gap-[15px]">
                    {userHasGeminiKey === false && !apiKeyStatusLoading && (
                        <button
                            onClick={() => setShowApiKeyModal(true)}
                            className={`${headerActionButtonBaseClasses} bg-[#fff3cd] text-[#664d03] border-[#ffecb5] hover:enabled:bg-[#ffeeba] hover:enabled:border-[#ffda6a]`}
                            title="Set your Gemini API Key"
                        >
                            ⚠️ Set API Key
                        </button>
                    )}
                    {user && user.email && <span className="text-sm text-[#5a6e87] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={user.email}>{user.email}</span>}
                    {user && (
                        <button onClick={handleSignOut} className={`${headerActionButtonBaseClasses} text-[#e74c3c] bg-transparent border-[#f5b7b1] hover:enabled:bg-[#fdedec] hover:enabled:text-[#cb4335] hover:enabled:border-[#f1948a]`}>
                            Logout
                        </button>
                    )}
                    {(parsedRepomixData || comparisonView) && (
                        <button
                            onClick={toggleFullScreenView}
                            className={headerActionButtonBaseClasses}
                            title={isFullScreenView ? "Exit Full Screen View" : "Expand File View"}
                            disabled={anyLoading && isFullScreenView} // Prevent collapsing while loading in FS
                        >
                            {isFullScreenView ? '📰 Collapse' : '↔️ Expand'}
                        </button>
                    )}
                </div>
            </header>

            <div className={`${mainContentWrapperBaseClasses} ${isFullScreenView ? fullscreenMainContentHeight : mainContentWrapperHeight}`}>
                {parsedRepomixData && isFullScreenView && !comparisonView && (
                    <div className={fileTreeFullscreenClasses}>
                      <FileTree
                          structure={parsedRepomixData.directoryStructure}
                          selectedFilePath={selectedFilePathForView}
                          onSelectFile={selectFileForViewing}
                          promptSelectedFilePaths={promptSelectedFilePaths}
                          onTogglePromptSelectedFile={togglePromptSelectedFile}
                          onSelectAllPromptFiles={selectAllPromptFiles}
                          onDeselectAllPromptFiles={deselectAllPromptFiles}
                      />
                    </div>
                )}

                <div className={`flex flex-col overflow-hidden h-full
                                 ${isFullScreenView
                                    ? (comparisonView
                                        ? chatColumnForComparisonViewClasses
                                        : centerColumnFullscreenClasses
                                      )
                                    : 'flex-grow border-r border-[#e7eaf3]'
                                 }`}
                >
                    <div className="flex-grow overflow-y-auto flex flex-col gap-6 px-[20px] lg:px-[30px] pt-6 pb-6 scrollable-content-area">
                        {userHasGeminiKey === false && !apiKeyStatusLoading && (
                            <div className="text-center mb-4 p-[10px] text-[#c0392b] bg-[#fadbd8] border border-[#f1948a] rounded-md">
                                Gemini API Key is not set. Chat functionality is disabled.
                                <button onClick={() => setShowApiKeyModal(true)} className="ml-2 px-2 py-1 text-xs bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Set Key</button>
                            </div>
                        )}
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 lg:gap-[30px] pb-6 mb-6 border-b border-[#e7eaf3]">
                            <div className="flex flex-col gap-6 lg:basis-1/2 w-full">
                                <div className={controlPanelBaseClasses}>
                                    <RepomixForm
                                        onGenerate={generateRepomixFile}
                                        isGenerating={repomixIsLoading && !parsedRepomixData && !selectedRepoFile} // More specific: loading AND no file is yet fully processed/selected
                                    />
                                 </div>
                                <div className={controlPanelBaseClasses}>
                                    <RepoSelector
                                        repos={availableRepos}
                                        onSelectRepo={loadRepoFileContent}
                                        isLoading={repomixIsLoading && (!selectedRepoFile || selectedRepoFile !== availableRepos.find(r=>r.filename === selectedRepoFile)?.filename)}
                                        selectedValue={selectedRepoFile || ""}
                                        onDeleteRepo={deleteRepomixFile} // Pass the delete function
                                        isDeleting={repomixIsLoading && !!selectedRepoFile} // Indicate deleting if loading and a file is selected
                                    />
                                 </div>
                                <div className={`${controlPanelBaseClasses}`}>
                                    <h3 className="text-lg font-semibold text-[#34495e] mt-0 mb-5">System Prompt</h3>
                                    <button
                                        onClick={() => setShowSystemPromptInput(prev => !prev)}
                                        className="self-start px-[15px] py-[9px] text-sm font-medium text-white bg-[#5dade2] border-none rounded-md cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#3498db] disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isSystemPromptSaving || isLoadingPrompt}
                                    >
                                        {isLoadingPrompt ? 'Loading...' : (showSystemPromptInput ? 'Hide' : 'Set') + ' System Prompt'}
                                    </button>
                                    {showSystemPromptInput && (
                                        <div className="flex flex-col gap-3 mt-4">
                                            <textarea
                                                value={systemPrompt}
                                                onChange={(e) => setSystemPrompt(e.target.value)}
                                                rows={3}
                                                className="w-full px-3 py-[10px] border border-[#ccd1d9] rounded-md text-base resize-y min-h-[80px] focus:outline-none focus:border-[#5dade2] focus:ring-3 focus:ring-[#5dade2]/15 disabled:bg-[#f4f6f8] disabled:text-[#aeb6bf]"
                                                disabled={isSystemPromptSaving || isLoadingPrompt}
                                                placeholder={isLoadingPrompt ? "Loading system prompt..." : "Enter system prompt (saved per user)..."}
                                            />
                                            <button
                                                onClick={handleSaveSystemPrompt}
                                                disabled={isSystemPromptSaving || isLoadingPrompt || !systemPrompt?.trim()}
                                                className="self-start px-[18px] py-[10px] text-sm font-medium text-white bg-[#2ecc71] border-none rounded-md cursor-pointer transition-colors duration-200 ease-in-out hover:enabled:bg-[#27ae60] disabled:bg-[#e5e7e9] disabled:text-[#909497] disabled:cursor-not-allowed"
                                            >
                                                {isSystemPromptSaving ? 'Saving...' : 'Save to DB'}
                                            </button>
                                            {systemPromptMessage && (
                                                <p className={`${statusMessageBaseClasses} ${systemPromptMessage.includes('Error') || systemPromptMessage.includes('Failed') ? statusMessageErrorClasses : statusMessageSuccessClasses}`}>
                                                    {systemPromptMessage}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-6 lg:basis-1/2 w-full">
                                <div className={controlPanelBaseClasses}>
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
                        </div>

                        {attachmentStatus && (
                             <div className={`${statusMessageBaseClasses} ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') || attachmentStatus.includes('Error') ? statusMessageWarningClasses : statusMessageSuccessClasses}`}>
                                {attachmentStatus}
                            </div>
                        )}

                        {globalError && <div className={`px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 ${statusMessageErrorClasses}`}>{globalError}</div>}

                        <ChatInterface
                            history={chatHistory}
                            onStartComparison={handleStartComparison}
                            parsedRepomixData={parsedRepomixData}
                        />
                        {chatIsLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                            <div className="px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 text-[#566573] italic">Thinking...</div>
                        )}
                    </div>

                    <div className="flex-shrink-0 bg-[#f8f9fc] px-[15px] sm:px-[25px] py-3 border-t border-[#e7eaf3] shadow-[0_-2px_5px_rgba(0,0,0,0.03)] z-10">
                        <InputArea
                            onPromptSubmit={handlePromptSubmit}
                            onFileAttach={handleManualFileAttach}
                            isLoading={anyLoading || (userHasGeminiKey === false && !apiKeyStatusLoading)}
                            attachedFileName={displayAttachedFileNameForInputArea}
                        />
                    </div>
                </div>

                {(parsedRepomixData || comparisonView) && isFullScreenView && (
                     <div className={
                        comparisonView
                            ? comparisonPanelForComparisonViewClasses
                            : fileContentPanelFullscreenClasses
                     }>
                        <FileContentDisplay
                            filePath={selectedFilePathForView}
                            content={selectedFileContentForView}
                            isLoading={repomixIsLoading && !!selectedFilePathForView && !selectedFileContentForView && !comparisonView}
                            comparisonData={comparisonView}
                            onCloseComparison={handleCloseComparison}
                        />
                     </div>
                )}
            </div>

            <footer className="flex items-center justify-end px-[30px] py-[10px] h-[45px] border-t border-[#e7eaf3] bg-[#f8f9fc] text-xs text-[#7f8c9a] flex-shrink-0">
                Powered by Gemini & Repomix
            </footer>
        </div>
    );
}

export default App;