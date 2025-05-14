// src/App.tsx (Refactored)
import { useMemo, useState, useEffect } from 'react';
import AuthForm from './components/AuthForm';
import ApiKeyModal from './components/ApiKeyModal';
import FileTree from './components/FileTree';
import FileContentDisplay from './components/FileContentDisplay';

import AppLayout from './layout/AppLayout';
import MainWorkspaceLayout from './layout/MainWorkspaceLayout';
import CentralInteractionPanel from './containers/CentralInteractionPanel';

import { useAuth } from './contexts/AuthContext';
import { useRepoFileManager } from './contexts/RepoFileManagerContext';
import { useActiveRepomixData } from './contexts/ActiveRepomixDataContext';

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
        fileContentVersion, // Get the version key
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
    const { isLoadingPrompt, isSystemPromptSaving } = useSystemPrompt();

    const apiKey = useApiKeyStatus({ updateGeminiConfig });
    const [globalAppError, setGlobalAppError] = useState<string | null>(null);

    // Effect to load data when a server file is selected OR its underlying content version changes
    useEffect(() => {
        // console.log('[App.tsx EFFECT] Triggered. selectedRepoFilename:', selectedRepoFilename, 'fileContentVersion:', fileContentVersion);
        if (selectedRepoFilename) {
            // console.log('[App.tsx EFFECT] Calling loadAndParseDataFromServerFile for:', selectedRepoFilename);
            loadAndParseDataFromServerFile(selectedRepoFilename);
        } else {
            // console.log('[App.tsx EFFECT] Clearing active data.');
            clearActiveData();
        }
    }, [selectedRepoFilename, fileContentVersion, loadAndParseDataFromServerFile, clearActiveData]); // <--- ADDED fileContentVersion HERE

    const chat = useChatHandler({
        userHasGeminiKey: apiKey.userHasGeminiKey,
        apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
        openApiKeyModal: apiKey.openApiKeyModal,
        parsedRepomixData,
        selectedRepoFile: activeRepomixSource?.filename || null,
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
        clearActiveData();
        selectRepoFileForProcessing(null);
    };

    const displayStatusMessage = useMemo(() => {
        if (generationStatus.error) return generationStatus.error;
        if (generationStatus.message) return generationStatus.message;
        if (activeDataAttachmentStatus) return activeDataAttachmentStatus;
        return null;
    }, [generationStatus, activeDataAttachmentStatus]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (generationStatus.message || generationStatus.error) {
                clearGenerationStatus();
            }
            if (activeDataAttachmentStatus) {
                clearActiveDataAttachmentStatus();
            }
        }, 7000);
        return () => clearTimeout(timer);
    }, [displayStatusMessage, clearGenerationStatus, clearActiveDataAttachmentStatus]);

    const displayAttachedFileNameForInputArea = useMemo(() => {
        if (promptSelectedFilePaths.length > 0 && parsedRepomixData) {
            const allFilesCount = allFilePathsInCurrentRepomix.length;
            if (allFilesCount > 0 && promptSelectedFilePaths.length === allFilesCount) {
                 return `All ${allFilesCount} file(s) selected for prompt`;
            }
            return `${promptSelectedFilePaths.length} file(s) selected for prompt`;
        }
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

    const configurationPanelProps = {
        availableRepos: availableRepoFiles,
        onSelectRepo: selectRepoFileForProcessing,
        isLoadingRepos: isLoadingRepoFiles,
        selectedRepoFilename: selectedRepoFilename,
        onDeleteRepo: deleteRepoFile,
        isDeleting: isDeleting,
        repoUrlForForm: repoUrlForForm,
        onRepoUrlChange: setRepoUrlForForm,
        onGenerateRepomix: async (url: string, inc: string, exc: string) => {
            const newFilename = await generateRepomixOutput(url, inc, exc);
            if (newFilename) {
                selectRepoFileForProcessing(newFilename);
            }
        },
        isGeneratingRepomix: isGenerating,
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
                        apiKeyStatus={{
                            userHasGeminiKey: apiKey.userHasGeminiKey,
                            apiKeyStatusLoading: apiKey.apiKeyStatusLoading,
                            openApiKeyModal: apiKey.openApiKeyModal,
                        }}
                        isChatLoading={chat.chatIsLoading}
                        attachmentStatus={displayStatusMessage}
                        currentError={currentError}
                        chatHistory={chat.chatHistory}
                        onStartComparison={view.startComparison}
                        parsedRepomixData={parsedRepomixData}
                        onPromptSubmit={chat.submitPrompt}
                        onFileAttach={(file: File) => loadAndParseDataFromManualFile(file, file.name)}
                        anyLoading={anyLoading}
                        displayAttachedFileNameForInputArea={displayAttachedFileNameForInputArea}
                        centerColumnClasses={centerColumnClassesForCentralPanel}
                        configPanelRepoFileProps={configurationPanelProps}
                    />
                }
                fileDisplayComponent={fileDisplayComponent}
                mainContentWrapperHeightClass={mainContentWrapperHeightClass}
            />
        </AppLayout>
    );
}

export default App;