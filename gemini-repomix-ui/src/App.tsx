// src/App.tsx (Refactored)
import { useMemo, useState } from 'react';
import AuthForm from './components/AuthForm';
import ApiKeyModal from './components/ApiKeyModal';
import FileTree from './components/FileTree';
import FileContentDisplay from './components/FileContentDisplay';

// New Layout/Container Components
import AppLayout from './layout/AppLayout';
import MainWorkspaceLayout from './layout/MainWorkspaceLayout';
import CentralInteractionPanel from './containers/CentralInteractionPanel';

// Contexts & Hooks
import { useAuth } from './contexts/AuthContext';
import { useRepomixContext } from './contexts/RepomixContext';
import { useModels } from './hooks/useModels';
import { useSystemPrompt } from './hooks/useSystemPrompt';
import { useApiKeyStatus } from './hooks/useApiKeyStatus';
import { useChatHandler } from './hooks/useChatHandler';
import { useAppView } from './hooks/useAppView';

// Tailwind class constants (assuming these are defined globally or imported, if still needed here)
const fullscreenMainContentHeight = "h-[calc(100vh_-_70px_-_0px)]"; // For main content area
const mainContentWrapperHeight = "h-[calc(100%_-_70px_-_45px)]"; // For main content area
const centerColumnFullscreenClasses = "flex-1 h-full flex flex-col overflow-hidden border-l border-r border-[#e7eaf3]";
const chatColumnForComparisonViewClasses = "flex-1 h-full flex flex-col overflow-hidden border-r border-[#e7eaf3]";


function App() {
    const { session, user, signOut, isLoading: authIsLoading } = useAuth();
    const {
        selectedRepoFile,
        parsedRepomixData,
        isLoading: repomixIsLoading,
        error: repomixError,
        attachmentStatus,
        selectedFilePathForView,
        selectedFileContentForView,
        promptSelectedFilePaths,
        allFilePathsInCurrentRepomix,
        handleManualFileAttach,
        selectFileForViewing,
        togglePromptSelectedFile,
        selectAllPromptFiles,
        deselectAllPromptFiles,
        clearCurrentRepomixData,
    } = useRepomixContext();

    const { updateGeminiConfig, selectedModelCallName, recordCallStats, resetCurrentCallStats, isLoadingModels, modelError } = useModels();
    const { isLoadingPrompt, isSystemPromptSaving } = useSystemPrompt(); // SystemPrompt related state is used in ConfigurationPanel, managed via CentralInteractionPanel

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

    // Prepare props for new components
    const appLayoutHeaderProps = {
        userHasGeminiKey: apiKey.userHasGeminiKey,
        apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
        onOpenApiKeyModal: apiKey.openApiKeyModal,
        userEmail: user.email,
        onSignOut: handleSignOut,
        showFullScreenToggle: !!parsedRepomixData || !!view.comparisonView,
        isFullScreenView: view.isFullScreenView,
        onToggleFullScreen: view.toggleFullScreenView,
        isToggleFullScreenDisabled: anyLoading && view.isFullScreenView, // Corrected: Disable toggle if already fullscreen and loading
    };

    const fileTreeComponent = (parsedRepomixData && view.isFullScreenView && !view.comparisonView) ? (
        <FileTree
            structure={parsedRepomixData.directoryStructure}
            selectedFilePath={selectedFilePathForView}
            onSelectFile={selectFileForViewing}
            promptSelectedFilePaths={promptSelectedFilePaths}
            onTogglePromptSelectedFile={togglePromptSelectedFile}
            onSelectAllPromptFiles={selectAllPromptFiles}
            onDeselectAllPromptFiles={deselectAllPromptFiles}
        />
    ) : null;

    const fileDisplayComponent = ((parsedRepomixData || view.comparisonView) && view.isFullScreenView) ? (
        <FileContentDisplay
            filePath={selectedFilePathForView}
            content={selectedFileContentForView}
            isLoading={repomixIsLoading && !!selectedFilePathForView && !selectedFileContentForView && !view.comparisonView}
            comparisonData={view.comparisonView}
            onCloseComparison={view.closeComparison}
        />
    ) : null;

    const mainContentWrapperHeightClass = view.isFullScreenView ? fullscreenMainContentHeight : mainContentWrapperHeight;

    const centerColumnClassesForCentralPanel = `flex flex-col overflow-hidden h-full
        ${view.isFullScreenView
            ? (view.comparisonView
                ? chatColumnForComparisonViewClasses
                : centerColumnFullscreenClasses)
            : 'flex-grow border-r border-[#e7eaf3]' // Default classes for normal view
        }`;


    return (
        <AppLayout
            isFullScreenView={view.isFullScreenView}
            headerProps={appLayoutHeaderProps}
        >
            {/* ApiKeyModal is a direct child of AppLayout, rendered on top */}
            <ApiKeyModal
                isOpen={apiKey.showApiKeyModal && apiKey.userHasGeminiKey === false && !apiKey.apiKeyStatusLoading}
                onClose={apiKey.closeApiKeyModal}
                onKeySubmitted={apiKey.handleApiKeySubmittedInModal}
            />
            {/* MainWorkspaceLayout handles the content area */}
            <MainWorkspaceLayout
                //isFullScreenView={view.isFullScreenView}
                isComparisonView={!!view.comparisonView}
                showFileTree={!!fileTreeComponent}
                fileTreeComponent={fileTreeComponent}
                centralPanelComponent={
                    <CentralInteractionPanel
                        apiKeyStatus={{
                            userHasGeminiKey: apiKey.userHasGeminiKey,
                            apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
                            openApiKeyModal: apiKey.openApiKeyModal,
                        }}
                        isChatLoading={chat.chatIsLoading}
                        attachmentStatus={attachmentStatus}
                        currentError={currentError}
                        chatHistory={chat.chatHistory}
                        onStartComparison={view.startComparison}
                        parsedRepomixData={parsedRepomixData}
                        onPromptSubmit={chat.submitPrompt}
                        onFileAttach={handleManualFileAttach}
                        anyLoading={anyLoading}
                        displayAttachedFileNameForInputArea={displayAttachedFileNameForInputArea}
                        centerColumnClasses={centerColumnClassesForCentralPanel}
                    />
                }
                fileDisplayComponent={fileDisplayComponent}
                mainContentWrapperHeightClass={mainContentWrapperHeightClass}
            />
        </AppLayout>
    );
}

export default App;