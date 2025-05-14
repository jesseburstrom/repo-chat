// src/App.tsx (Refactored)
import { useMemo, useState, useEffect } from 'react'; // Added useCallback
import AuthForm from './components/AuthForm';
import ApiKeyModal from './components/ApiKeyModal';
import FileTree from './components/FileTree';
import FileContentDisplay from './components/FileContentDisplay';

import AppLayout from './layout/AppLayout';
import MainWorkspaceLayout from './layout/MainWorkspaceLayout';
import CentralInteractionPanel from './containers/CentralInteractionPanel';

import { useAuth } from './contexts/AuthContext';
import { useRepoFileManager } from './contexts/RepoFileManagerContext'; // New
import { useActiveRepomixData } from './contexts/ActiveRepomixDataContext'; // New

import { useModels } from './hooks/useModels';
import { useSystemPrompt } from './hooks/useSystemPrompt';
import { useApiKeyStatus } from './hooks/useApiKeyStatus';
import { useChatHandler } from './hooks/useChatHandler';
import { useAppView } from './hooks/useAppView';

// Tailwind class constants
const fullscreenMainContentHeight = "h-[calc(100vh_-_70px_-_0px)]";
const mainContentWrapperHeight = "h-[calc(100%_-_70px_-_45px)]";
const centerColumnFullscreenClasses = "flex-1 h-full flex flex-col overflow-hidden border-l border-r border-[#e7eaf3]";
const chatColumnForComparisonViewClasses = "flex-1 h-full flex flex-col overflow-hidden border-r border-[#e7eaf3]";


function App() {
    const { session, user, signOut, isLoading: authIsLoading } = useAuth();

    // Consume from RepoFileManagerContext
    const {
        availableRepoFiles,
        isLoadingRepoFiles,
        repoFilesError,
        isGenerating,
        generationStatus,
        deleteRepoFile,
        selectedRepoFilename,
        selectRepoFileForProcessing,
        repoUrlForForm,
        setRepoUrlForForm,
        generateRepomixOutput,
        isDeleting,
        clearGenerationStatus,
    } = useRepoFileManager();

    // Consume from ActiveRepomixDataContext
    const {
        activeRepomixSource,
        parsedRepomixData,
        isLoadingData: isActiveDataLoading,
        dataError: activeDataError,
        attachmentStatus: activeDataAttachmentStatus,
        loadAndParseDataFromServerFile,
        loadAndParseDataFromManualFile,
        clearActiveData,
        selectedFilePathForView,
        selectedFileContentForView,
        promptSelectedFilePaths,
        allFilePathsInCurrentRepomix,
        selectFileForViewing,
        togglePromptSelectedFile,
        selectAllPromptFiles,
        deselectAllPromptFiles,
        clearAttachmentStatus: clearActiveDataAttachmentStatus,
    } = useActiveRepomixData();

    const { updateGeminiConfig, selectedModelCallName, recordCallStats, resetCurrentCallStats, isLoadingModels, modelError } = useModels();
    const { isLoadingPrompt, isSystemPromptSaving } = useSystemPrompt(); // SystemPrompt hooks are self-contained for ConfigurationPanel

    const apiKey = useApiKeyStatus({ updateGeminiConfig });
    const [globalAppError, setGlobalAppError] = useState<string | null>(null); // For AppView related errors

    // Effect to load data when a server file is selected by RepoFileManager
    useEffect(() => {
        if (selectedRepoFilename) {
            loadAndParseDataFromServerFile(selectedRepoFilename);
        } else {
            clearActiveData(); // Clear data if no file is selected
        }
    }, [selectedRepoFilename, loadAndParseDataFromServerFile, clearActiveData]);

    const chat = useChatHandler({
        userHasGeminiKey: apiKey.userHasGeminiKey,
        apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
        openApiKeyModal: apiKey.openApiKeyModal,
        parsedRepomixData, // From ActiveRepomixDataContext
        selectedRepoFile: activeRepomixSource?.filename || null, // From ActiveRepomixDataContext
        promptSelectedFilePaths, // From ActiveRepomixDataContext
        selectedModelCallName,
        recordCallStats,
        resetCurrentCallStats,
    });

    const view = useAppView({
        parsedRepomixData, // From ActiveRepomixDataContext
        setGlobalError: (err) => {
            if (err) {
                setGlobalAppError(err);
                chat.clearChatError(); // Clear chat specific error if a global one is set
            } else {
                setGlobalAppError(null);
            }
        },
    });

    const handleSignOut = async () => {
        await signOut();
        clearActiveData();
        selectRepoFileForProcessing(null); // Clear selected file in manager
    };

    // Combine attachment/generation statuses for display
    const displayStatusMessage = useMemo(() => {
        if (generationStatus.error) return generationStatus.error;
        if (generationStatus.message) return generationStatus.message;
        if (activeDataAttachmentStatus) return activeDataAttachmentStatus;
        return null;
    }, [generationStatus, activeDataAttachmentStatus]);

    // Clear status messages after a delay or on new action
    useEffect(() => {
        const timer = setTimeout(() => {
            if (generationStatus.message || generationStatus.error) {
                clearGenerationStatus();
            }
            if (activeDataAttachmentStatus) {
                clearActiveDataAttachmentStatus();
            }
        }, 7000); // Longer timeout for combined statuses
        return () => clearTimeout(timer);
    }, [displayStatusMessage, clearGenerationStatus, clearActiveDataAttachmentStatus]);


    const displayAttachedFileNameForInputArea = useMemo(() => {
        if (promptSelectedFilePaths.length > 0 && parsedRepomixData) { // Ensure parsedRepomixData exists for this message
            const allFilesCount = allFilePathsInCurrentRepomix.length;
            if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                 return `All ${allFilesCount} file(s) selected for prompt`;
            }
            return `${promptSelectedFilePaths.length} file(s) selected for prompt`;
        }
        // Use activeRepomixSource for the general "attached file" name
        if (activeRepomixSource?.filename) {
            const typePrefix = activeRepomixSource.type === 'manual' ? "Manually Attached: " : "Active: ";
            return typePrefix + activeRepomixSource.filename;
        }
        return null;
    }, [promptSelectedFilePaths, allFilePathsInCurrentRepomix, activeRepomixSource, parsedRepomixData]);

    const anyLoading = chat.chatIsLoading || isLoadingRepoFiles || isGenerating || isActiveDataLoading ||
                       isLoadingModels || isLoadingPrompt || isSystemPromptSaving || apiKey.apiKeyStatusLoading || isDeleting;

    const currentError = globalAppError || modelError || repoFilesError || activeDataError || chat.chatError || apiKey.apiKeyError || generationStatus.error;


    if (authIsLoading || (session && apiKey.apiKeyStatusLoading && apiKey.userHasGeminiKey === null)) {
        return <div className="flex justify-center items-center h-screen text-center text-lg">Loading application essentials...</div>;
    }
    if (!session || !user) {
        return <AuthForm />;
    }

    const appLayoutHeaderProps = {
        userHasGeminiKey: apiKey.userHasGeminiKey,
        apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
        onOpenApiKeyModal: apiKey.openApiKeyModal,
        userEmail: user.email,
        onSignOut: handleSignOut,
        showFullScreenToggle: !!parsedRepomixData || !!view.comparisonView,
        isFullScreenView: view.isFullScreenView,
        onToggleFullScreen: view.toggleFullScreenView,
        isToggleFullScreenDisabled: anyLoading && view.isFullScreenView,
    };

    // FileTree now consumes ActiveRepomixDataContext for its data
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

    // FileContentDisplay now consumes ActiveRepomixDataContext for its data
    const fileDisplayComponent = ((parsedRepomixData || view.comparisonView) && view.isFullScreenView) ? (
        <FileContentDisplay
            filePath={selectedFilePathForView}
            content={selectedFileContentForView}
            isLoading={isActiveDataLoading && !!selectedFilePathForView && !selectedFileContentForView && !view.comparisonView}
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
            : 'flex-grow border-r border-[#e7eaf3]'
        }`;

    // Props for ConfigurationPanel - this component would need to be refactored
    // to accept these or consume contexts directly.
    const configurationPanelProps = {
        // From RepoFileManagerContext
        availableRepos: availableRepoFiles,
        onSelectRepo: selectRepoFileForProcessing, // This changes role
        isLoadingRepos: isLoadingRepoFiles,
        selectedRepoFilename: selectedRepoFilename,
        onDeleteRepo: deleteRepoFile,
        isDeleting: isDeleting,
        repoUrlForForm: repoUrlForForm,
        onRepoUrlChange: setRepoUrlForForm,
        onGenerateRepomix: async (url: string, inc: string, exc: string) => { // Wrapper for generateRepomixOutput
            const newFilename = await generateRepomixOutput(url, inc, exc);
            if (newFilename) {
                selectRepoFileForProcessing(newFilename); // Auto-select new file
            }
        },
        isGeneratingRepomix: isGenerating,
        // From useSystemPrompt (passed through)
        // systemPrompt, setSystemPrompt, showSystemPromptInput, setShowSystemPromptInput,
        // isLoadingSystemPrompt: isLoadingPrompt, isSavingSystemPrompt: isSystemPromptSaving,
        // systemPromptMessage, handleSaveSystemPrompt,
        // From useModels (passed through)
        // availableModels, selectedModelCallName, onModelChange, isLoadingModels,
        // currentCallStats, totalSessionStats,
    };


    return (
        <AppLayout
            isFullScreenView={view.isFullScreenView}
            headerProps={appLayoutHeaderProps}
        >
            <ApiKeyModal
                isOpen={apiKey.showApiKeyModal && apiKey.userHasGeminiKey === false && !apiKey.apiKeyStatusLoading}
                onClose={apiKey.closeApiKeyModal}
                onKeySubmitted={apiKey.handleApiKeySubmittedInModal}
            />
            <MainWorkspaceLayout
                isComparisonView={!!view.comparisonView}
                showFileTree={!!fileTreeComponent}
                fileTreeComponent={fileTreeComponent}
                centralPanelComponent={
                    <CentralInteractionPanel
                        apiKeyStatus={{ // This remains the same
                            userHasGeminiKey: apiKey.userHasGeminiKey,
                            apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
                            openApiKeyModal: apiKey.openApiKeyModal,
                        }}
                        isChatLoading={chat.chatIsLoading}
                        // Updated props sourcing from new contexts
                        attachmentStatus={displayStatusMessage} // Combined status
                        currentError={currentError}
                        chatHistory={chat.chatHistory}
                        onStartComparison={view.startComparison}
                        parsedRepomixData={parsedRepomixData}
                        onPromptSubmit={chat.submitPrompt}
                        onFileAttach={(file: File) => loadAndParseDataFromManualFile(file, file.name)}
                        anyLoading={anyLoading}
                        displayAttachedFileNameForInputArea={displayAttachedFileNameForInputArea}
                        centerColumnClasses={centerColumnClassesForCentralPanel}
                        // Pass down configurationPanelProps to CentralInteractionPanel
                        // if ConfigurationPanel is a child of it and not directly consuming contexts.
                        // This example assumes CentralInteractionPanel might render ConfigurationPanel
                        // or ConfigurationPanel is refactored to consume contexts.
                        // For simplicity, I'll show passing necessary specific props to ConfigPanel via CentralPanel.
                        // This might mean CentralInteractionPanel needs to accept these and pass them on.
                        // OR, ConfigurationPanel is moved outside CentralInteractionPanel and consumes contexts directly.
                        // Let's assume CentralInteractionPanel is updated to take these:
                        configPanelRepoFileProps={configurationPanelProps} // Pass this down
                    />
                }
                fileDisplayComponent={fileDisplayComponent}
                mainContentWrapperHeightClass={mainContentWrapperHeightClass}
            />
        </AppLayout>
    );
}

export default App;

// NOTE for CentralInteractionPanel.tsx:
// You'll need to update CentralInteractionPanel to accept `configPanelRepoFileProps`
// and pass them to `<ConfigurationPanel {...props.configPanelRepoFileProps} ... />`.
// Alternatively, and perhaps cleaner, ConfigurationPanel itself could be refactored
// to directly use `useRepoFileManager()`, `useSystemPrompt()`, and `useModels()`.
// This would remove the need to pass so many props through CentralInteractionPanel.
// The example above sets up `configurationPanelProps` as if `CentralInteractionPanel` will forward them.