// gemini-repomix-ui/src/App.tsx
import { useMemo, useState } from 'react'; // Added useState import
import ChatInterface from './ChatInterface';
import InputArea from './InputArea';
import FileTree from './FileTree';
import FileContentDisplay from './FileContentDisplay';
import AuthForm from './AuthForm';
import ApiKeyModal from './ApiKeyModal';
import AppHeader from './AppHeader'; // New
import ConfigurationPanel from './ConfigurationPanel'; // New

// Contexts & Hooks
import { useAuth } from './contexts/AuthContext';
import { useRepomixContext } from './contexts/RepomixContext';
import { useModels } from './hooks/useModels';
import { useSystemPrompt } from './hooks/useSystemPrompt';
import { useApiKeyStatus } from './hooks/useApiKeyStatus'; // New
import { useChatHandler } from './hooks/useChatHandler';   // New
import { useAppView } from './hooks/useAppView';         // New

// Types (ChatMessage is no longer directly used here, it's in useChatHandler)
// import type { ChatMessage } from './types'; // ChatMessage is not directly used in App.tsx anymore


function App() {
    const { session, user, signOut, isLoading: authIsLoading } = useAuth();
    const {
        // availableRepos, // No longer directly used in App.tsx
        selectedRepoFile,
        parsedRepomixData,
        isLoading: repomixIsLoading,
        error: repomixError,
        attachmentStatus,
        selectedFilePathForView,
        selectedFileContentForView,
        promptSelectedFilePaths,
        allFilePathsInCurrentRepomix,
        // generateRepomixFile, // No longer directly used in App.tsx (used in ConfigurationPanel)
        // loadRepoFileContent, // No longer directly used in App.tsx (used in ConfigurationPanel)
        handleManualFileAttach,
        selectFileForViewing,
        togglePromptSelectedFile,
        selectAllPromptFiles,
        deselectAllPromptFiles,
        clearCurrentRepomixData,
        // deleteRepomixFile, // No longer directly used in App.tsx (used in ConfigurationPanel)
        // repoUrl, // No longer directly used in App.tsx (used in ConfigurationPanel)
        // setRepoUrl, // No longer directly used in App.tsx (used in ConfigurationPanel)
    } = useRepomixContext();

    const { updateGeminiConfig, selectedModelCallName, recordCallStats, resetCurrentCallStats, isLoadingModels, modelError } = useModels();
    const { isLoadingPrompt, isSystemPromptSaving } = useSystemPrompt();

    const apiKey = useApiKeyStatus({ updateGeminiConfig });
    const [globalAppError, setGlobalAppError] = useState<string | null>(null);

    const chat = useChatHandler({
        userHasGeminiKey: apiKey.userHasGeminiKey,
        apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
        openApiKeyModal: apiKey.openApiKeyModal,
        parsedRepomixData,
        selectedRepoFile,
        promptSelectedFilePaths,
        selectedModelCallName,
        recordCallStats,
        resetCurrentCallStats,
    });

    const view = useAppView({
        parsedRepomixData,
        setGlobalError: (err) => {
            if (err) {
                setGlobalAppError(err);
                chat.clearChatError();
            } else {
                setGlobalAppError(null);
            }
        },
    });

    const handleSignOut = async () => {
        await signOut();
        clearCurrentRepomixData();
    };

    const displayAttachedFileNameForInputArea = useMemo(() => {
        if (promptSelectedFilePaths.length > 0) {
            const allFilesCount = allFilePathsInCurrentRepomix.length;
            if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                 return `All ${allFilesCount} file(s) selected for prompt`;
            }
            return `${promptSelectedFilePaths.length} file(s) selected for prompt`;
        }
        if (selectedRepoFile && parsedRepomixData) return selectedRepoFile;
        if (!selectedRepoFile && parsedRepomixData && attachmentStatus?.startsWith("Attached & Parsed")) {
            return attachmentStatus.replace("Attached & Parsed ", "").replace(" successfully.", "") || "Manually attached file";
        }
        return null;
    }, [promptSelectedFilePaths, allFilePathsInCurrentRepomix, selectedRepoFile, parsedRepomixData, attachmentStatus]);

    const anyLoading = chat.chatIsLoading || repomixIsLoading || isLoadingModels ||
                       isLoadingPrompt || isSystemPromptSaving || apiKey.apiKeyStatusLoading;

    const currentError = globalAppError || modelError || repomixError || chat.chatError || apiKey.apiKeyError;


    if (authIsLoading || (session && apiKey.apiKeyStatusLoading && apiKey.userHasGeminiKey === null)) {
        return <div className="flex justify-center items-center h-screen text-center text-lg">Loading application essentials...</div>;
    }
    if (!session || !user) {
        return <AuthForm />;
    }

    // --- Tailwind Class Definitions for App Layout ---
    const appContainerBaseClasses = "flex flex-col h-screen bg-white border border-[#e7eaf3] overflow-hidden";
    const appContainerNormalClasses = "w-[80%] mx-auto my-[30px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08),_0_1px_3px_rgba(0,0,0,0.05)] h-[calc(100vh_-_60px)]";
    const appContainerFullscreenClasses = "w-full max-w-none m-0 border-none rounded-none shadow-none h-screen";
    const mainContentWrapperBaseClasses = "flex flex-row flex-grow overflow-hidden";
    const mainContentWrapperHeight = "h-[calc(100%_-_70px_-_45px)]";
    const fullscreenMainContentHeight = "h-[calc(100vh_-_70px_-_0px)]";
    const fileTreeFullscreenClasses = "w-[22%] max-w-[450px] h-full flex-shrink-0";
    const centerColumnFullscreenClasses = "flex-1 h-full flex flex-col overflow-hidden border-l border-r border-[#e7eaf3]";
    const fileContentPanelFullscreenClasses = "flex-1 h-full overflow-hidden border-l border-[#e7eaf3]";
    const chatColumnForComparisonViewClasses = "flex-1 h-full flex flex-col overflow-hidden border-r border-[#e7eaf3]";
    const comparisonPanelForComparisonViewClasses = "flex-[2_1_0%] h-full overflow-hidden";
    const statusMessageWarningClasses = "bg-[#fdebd0] text-[#e67e22] border-[#f5cba7]";
    const statusMessageErrorClasses = "bg-[#fdedec] text-[#e74c3c] border-[#f5b7b1]";
    const statusMessageSuccessClasses = "bg-[#e8f8f5] text-[#1abc9c] border-[#a3e4d7]";


    return (
        <div className={`${appContainerBaseClasses} ${view.isFullScreenView ? appContainerFullscreenClasses : appContainerNormalClasses}`}>
            <ApiKeyModal
                isOpen={apiKey.showApiKeyModal && apiKey.userHasGeminiKey === false && !apiKey.apiKeyStatusLoading}
                onClose={apiKey.closeApiKeyModal}
                onKeySubmitted={apiKey.handleApiKeySubmittedInModal}
            />

            <AppHeader
                userHasGeminiKey={apiKey.userHasGeminiKey}
                apiKeyStatusLoading={apiKey.apiKeyStatusLoading}
                onOpenApiKeyModal={apiKey.openApiKeyModal}
                userEmail={user.email}
                onSignOut={handleSignOut}
                showFullScreenToggle={!!parsedRepomixData || !!view.comparisonView}
                isFullScreenView={view.isFullScreenView}
                onToggleFullScreen={view.toggleFullScreenView}
                isToggleFullScreenDisabled={anyLoading && view.isFullScreenView}
            />

            <div className={`${mainContentWrapperBaseClasses} ${view.isFullScreenView ? fullscreenMainContentHeight : mainContentWrapperHeight}`}>
                {parsedRepomixData && view.isFullScreenView && !view.comparisonView && (
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
                                 ${view.isFullScreenView
                                    ? (view.comparisonView
                                        ? chatColumnForComparisonViewClasses
                                        : centerColumnFullscreenClasses
                                      )
                                    : 'flex-grow border-r border-[#e7eaf3]'
                                 }`}
                >
                    <div className="flex-grow overflow-y-auto flex flex-col gap-6 px-[20px] lg:px-[30px] pt-6 pb-6 scrollable-content-area">
                        <ConfigurationPanel
                            apiKeyStatus={{
                                userHasGeminiKey: apiKey.userHasGeminiKey,
                                apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
                                openApiKeyModal: apiKey.openApiKeyModal,
                            }}
                            isChatLoading={chat.chatIsLoading}
                        />

                        {attachmentStatus && (
                             <div className={`px-[15px] py-[10px] mt-[10px] rounded-md text-sm border ${attachmentStatus.includes('Failed') || attachmentStatus.includes('non-standard') || attachmentStatus.includes('Error') ? statusMessageWarningClasses : statusMessageSuccessClasses}`}>
                                {attachmentStatus}
                            </div>
                        )}

                        {currentError && (
                            <div className={`px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 ${statusMessageErrorClasses}`}>
                                {currentError}
                            </div>
                        )}

                        <ChatInterface
                            history={chat.chatHistory}
                            onStartComparison={view.startComparison}
                            parsedRepomixData={parsedRepomixData}
                        />
                        {chat.chatIsLoading && chat.chatHistory.length > 0 && chat.chatHistory[chat.chatHistory.length - 1].role === 'user' && (
                            <div className="px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 text-[#566573] italic">Thinking...</div>
                        )}
                    </div>

                    <div className="flex-shrink-0 bg-[#f8f9fc] px-[15px] sm:px-[25px] py-3 border-t border-[#e7eaf3] shadow-[0_-2px_5px_rgba(0,0,0,0.03)] z-10">
                        <InputArea
                            onPromptSubmit={chat.submitPrompt}
                            onFileAttach={handleManualFileAttach}
                            isLoading={anyLoading || (apiKey.userHasGeminiKey === false && !apiKey.apiKeyStatusLoading)}
                            attachedFileName={displayAttachedFileNameForInputArea}
                        />
                    </div>
                </div>

                {(parsedRepomixData || view.comparisonView) && view.isFullScreenView && (
                     <div className={
                        view.comparisonView
                            ? comparisonPanelForComparisonViewClasses
                            : fileContentPanelFullscreenClasses
                     }>
                        <FileContentDisplay
                            filePath={selectedFilePathForView}
                            content={selectedFileContentForView}
                            isLoading={repomixIsLoading && !!selectedFilePathForView && !selectedFileContentForView && !view.comparisonView}
                            comparisonData={view.comparisonView}
                            onCloseComparison={view.closeComparison}
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