// gemini-repomix-ui/src/App.tsx
import { useState, useCallback, useMemo, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import RepomixForm from './RepomixForm';
import RepoSelector from './RepoSelector';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
import ModelSettings from './ModelSettings';
// Removed App.css import: import './App.css';

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
    const [userHasGeminiKey, setUserHasGeminiKey] = useState<boolean | null>(null);
    const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
    const [apiKeyStatusLoading, setApiKeyStatusLoading] = useState<boolean>(true);

    // --- Custom Hooks ---
    const {
        systemPrompt,
        setSystemPrompt,
        showSystemPromptInput,
        setShowSystemPromptInput,
        isLoadingPrompt,
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
    } = useModels();

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
                    setChatError("Could not verify Gemini API key status.");
                    setUserHasGeminiKey(false);
                }
                setApiKeyStatusLoading(false);
            } else if (!session && !authIsLoading) {
                 setUserHasGeminiKey(null);
                 setShowApiKeyModal(false);
                 setApiKeyStatusLoading(false);
            }
        };
        checkApiKeyStatus();
    }, [session, user, authIsLoading]);

    const handleApiKeySubmitted = useCallback(() => {
        if (session && user && !authIsLoading) {
            setApiKeyStatusLoading(true);
            api.getGeminiApiKeyStatus().then(statusResult => {
                if (statusResult.success) {
                    setUserHasGeminiKey(statusResult.hasKey ?? false);
                    if (statusResult.hasKey) {
                        setShowApiKeyModal(false);
                        setChatError(null);
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
        if (userHasGeminiKey === false) {
            setChatError("Gemini API Key is not set. Please set your API key.");
            setShowApiKeyModal(true); return;
        }
        if (userHasGeminiKey === null && !apiKeyStatusLoading) {
            setChatError("Could not verify API key status. Please try again or set your key.");
            setShowApiKeyModal(true); return;
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
        chatHistory, selectedModelCallName, recordCallStats, resetCurrentCallStats,
        parsedRepomixData, promptSelectedFilePaths, attachedFileName,
        userHasGeminiKey, apiKeyStatusLoading
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
                       isLoadingSelectedFileForView || isLoadingRepos || isSystemPromptSaving || apiKeyStatusLoading || isLoadingPrompt;

    if (authIsLoading || (session && apiKeyStatusLoading && userHasGeminiKey === null) ) {
        // Apply basic centering and text styles for loading message
        return <div className="flex justify-center items-center h-screen text-center text-lg">Loading application essentials...</div>;
    }
    if (!session || !user) {
        return <AuthForm />;
    }

    // --- Base and Conditional Classes ---
    // Using clsx or classnames library can make managing conditional classes cleaner,
    // but for now, template literals will work.

    const appContainerBaseClasses = "flex flex-col h-screen bg-white border border-[#e7eaf3] overflow-hidden";
    const appContainerNormalClasses = "w-[80%] mx-auto rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08),_0_1px_3px_rgba(0,0,0,0.05)]";
    const appContainerFullscreenClasses = "w-full max-w-none m-0 border-none rounded-none shadow-none";

    const mainContentWrapperBaseClasses = "flex flex-row flex-grow overflow-hidden";
    // Calculate height using arbitrary value syntax for calc()
    const mainContentWrapperHeight = "h-[calc(100vh_-_70px_-_45px)]";
    const fullscreenMainContentHeight = "h-[calc(100vh_-_70px)]";

    const fileTreeFullscreenClasses = "w-[22%] max-w-[450px] h-full";
    const centerColumnFullscreenClasses = "w-[38%] flex-shrink-0 h-full flex flex-col overflow-hidden border-l border-r border-[#e7eaf3]";
    const fileContentPanelFullscreenClasses = "flex-1 border-l border-[#e7eaf3] h-full overflow-hidden"; // flex-1 and overflow-hidden

    const headerActionButtonBaseClasses = "px-3 py-[6px] text-sm rounded-md cursor-pointer border border-[#d9dce3] bg-[#f0f2f5] text-[#333] transition-colors duration-200 ease-in-out leading-snug hover:enabled:bg-[#e7eaf3] hover:enabled:border-[#c8cdd8] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";

    const controlPanelBaseClasses = "px-6 py-5 border border-[#e0e6ed] rounded-lg bg-white shadow-sm"; // Using px-6=24px, py-5=20px, shadow-sm

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
                {user && user.email && <span className="text-sm text-[#5a6e87] whitespace-nowrap">{user.email}</span>}
                {user && (
                    <button onClick={signOut} className={`${headerActionButtonBaseClasses} text-[#e74c3c] bg-transparent border-[#f5b7b1] hover:enabled:bg-[#fdedec] hover:enabled:text-[#cb4335] hover:enabled:border-[#f1948a]`}>
                        Logout
                    </button>
                )}
                {(parsedRepomixData || comparisonView) && (
                    <button
                        onClick={toggleFullScreenView}
                        className={headerActionButtonBaseClasses}
                        title={isFullScreenView ? "Exit Full Screen View" : "Expand File View"}
                        disabled={anyLoading && isFullScreenView}
                    >
                        {isFullScreenView ? '📰 Collapse' : '↔️ Expand'}
                    </button>
                )}
            </div>
        </header>

        <div className={`${mainContentWrapperBaseClasses} ${isFullScreenView ? fullscreenMainContentHeight : mainContentWrapperHeight}`}>
            {/* File Tree (Conditional) */}
            {parsedRepomixData && isFullScreenView && !comparisonView && (
                <div className={fileTreeFullscreenClasses}> {/* Added wrapper for sizing */}
                  <FileTree
                      structure={parsedRepomixData.directoryStructure}
                      selectedFilePath={selectedFilePathForView}
                      onSelectFile={handleSelectFileForViewing}
                      promptSelectedFilePaths={promptSelectedFilePaths}
                      onTogglePromptSelectedFile={handleTogglePromptSelectedFile}
                      onSelectAllPromptFiles={handleSelectAllPromptFiles}
                      onDeselectAllPromptFiles={handleDeselectAllPromptFiles}
                  />
                </div>
            )}

             {/* Center Column */}
            <div className={`flex flex-col flex-grow overflow-hidden ${isFullScreenView && !comparisonView ? centerColumnFullscreenClasses : 'border-r border-[#e7eaf3]'}`}>
                {/* Scrollable Area */}
                <div className="flex-grow overflow-y-auto flex flex-col gap-6 px-[30px] pt-6 pb-6"> {/* Using gap-6=24px, p-6=24px */}
                    {userHasGeminiKey === false && !apiKeyStatusLoading && (
                        <div className="text-center mb-4 p-[10px] text-[#c0392b] bg-[#fadbd8] border border-[#f1948a] rounded-md"> {/* Error message style */}
                            Gemini API Key is not set. Chat functionality is disabled.
                            <button onClick={() => setShowApiKeyModal(true)} className="ml-2 px-2 py-1 text-xs bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Set Key</button>
                        </div>
                    )}
                    {/* Top Controls Row */}
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 lg:gap-[30px] pb-6 mb-6 border-b border-[#e7eaf3]">
                        {/* Left Controls */}
                        <div className="flex flex-col gap-6 lg:basis-1/2">
                            <div className={controlPanelBaseClasses}>
                                <RepomixForm
                                    repoUrl={repoUrl}
                                    onRepoUrlChange={onRepoUrlChange}
                                    onGenerate={handleGenerateRepomixFile}
                                    isGenerating={isGenerating}
                                    generationMessage={generationMessage}
                                    generationError={generationError}
                                />
                             </div>
                            <div className={controlPanelBaseClasses}>
                                <RepoSelector
                                    repos={availableRepos}
                                    onSelectRepo={loadRepoFileContent}
                                    isLoading={isLoadingRepos || isLoadingFileContent}
                                    selectedValue={selectedRepoFile}
                                />
                             </div>
                            <div className={`${controlPanelBaseClasses} system-prompt-settings-group`}> {/* Keep class if children target it */}
                                <h3 className="text-lg font-semibold text-[#34495e] mt-0 mb-5">System Prompt</h3>
                                <button
                                    onClick={() => setShowSystemPromptInput(prev => !prev)}
                                    className="self-start px-[15px] py-[9px] text-sm font-medium text-white bg-[#5dade2] border-none rounded-md cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#3498db] disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSystemPromptSaving || isLoadingPrompt}
                                >
                                    {isLoadingPrompt ? 'Loading...' : (showSystemPromptInput ? 'Hide' : 'Set') + ' System Prompt'}
                                </button>
                                {showSystemPromptInput && (
                                    <div className="flex flex-col gap-3 mt-4"> {/* gap-3=12px, mt-4=16px */}
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
                                            <p className={`${statusMessageBaseClasses} ${systemPromptMessage.includes('Error') ? statusMessageErrorClasses : statusMessageSuccessClasses}`}>
                                                {systemPromptMessage}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Right Controls */}
                        <div className="flex flex-col gap-6 lg:basis-1/2">
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
                    </div> {/* End Top Controls Row */}

                    {/* Attachment Status */}
                    {attachmentStatus && (
                         <div className={`${statusMessageBaseClasses} ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') ? statusMessageWarningClasses : statusMessageSuccessClasses}`}>
                            {attachmentStatus}
                        </div>
                    )}

                    {/* Global Error */}
                    {globalError && <div className={`px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 text-[#c0392b] bg-[#fadbd8] border border-[#f1948a]`}>{globalError}</div>}

                    {/* Chat Interface */}
                    <ChatInterface
                        history={chatHistory}
                        onStartComparison={handleStartComparison}
                        parsedRepomixData={parsedRepomixData}
                    />
                    {chatIsLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                        <div className="px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 text-[#566573] italic">Thinking...</div>
                    )}
                </div> {/* End Scrollable Area */}

                {/* Input Area Container */}
                <div className="flex-shrink-0 bg-[#f8f9fc] px-[25px] py-3 border-t border-[#e7eaf3] shadow-[0_-2px_5px_rgba(0,0,0,0.03)] z-10">
                    <InputArea
                        onPromptSubmit={handlePromptSubmit}
                        onFileAttach={handleManualFileAttach}
                        isLoading={anyLoading || (userHasGeminiKey === false && !apiKeyStatusLoading)}
                        attachedFileName={displayAttachedFileNameForInputArea}
                    />
                </div>
            </div> {/* End Center Column */}

            {/* File Content Display (Conditional) */}
            {(parsedRepomixData || comparisonView) && isFullScreenView && (
                 <div className={fileContentPanelFullscreenClasses}> {/* Added wrapper for sizing */}
                    <FileContentDisplay
                        filePath={selectedFilePathForView}
                        content={selectedFileContentForView}
                        isLoading={isLoadingSelectedFileForView && !comparisonView}
                        comparisonData={comparisonView}
                        onCloseComparison={handleCloseComparison}
                    />
                 </div>
            )}
        </div> {/* End Main Content Wrapper */}

        <footer className="flex items-center justify-end px-[30px] py-[10px] h-[45px] border-t border-[#e7eaf3] bg-[#f8f9fc] text-xs text-[#7f8c9a] flex-shrink-0">
            {/* Optional: Add footer content like version or links */}
            Powered by Gemini & Repomix
        </footer>
    </div>
);
}

export default App;