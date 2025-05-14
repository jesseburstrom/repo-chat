// gemini-repomix-ui/src/components/ConfigurationPanel.tsx
import React from 'react';
import RepomixForm from './RepomixForm';
import RepoSelector from './RepoSelector';
import ModelSettings from './ModelSettings';
import { useRepomixContext } from '../contexts/RepomixContext';
import { useSystemPrompt } from '../hooks/useSystemPrompt';
import { useModels } from '../hooks/useModels';
import { UseApiKeyStatusReturn } from '../hooks/useApiKeyStatus'; // Import the return type

interface ConfigurationPanelProps {
    apiKeyStatus: Pick<UseApiKeyStatusReturn, 'userHasGeminiKey' | 'apiKeyStatusLoading' | 'openApiKeyModal'>;
    isChatLoading: boolean; // from useChatHandler
}

const controlPanelBaseClasses = "px-6 py-5 border border-[#e0e6ed] rounded-lg bg-white shadow-sm";
const statusMessageBaseClasses = "px-[15px] py-[10px] mt-[10px] rounded-md text-sm border";
const statusMessageSuccessClasses = "bg-[#e8f8f5] text-[#1abc9c] border-[#a3e4d7]";
const statusMessageErrorClasses = "bg-[#fdedec] text-[#e74c3c] border-[#f5b7b1]";


const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ apiKeyStatus, isChatLoading }) => {
    const {
        generateRepomixFile, isLoading: repomixIsLoading, availableRepos, loadRepoFileContent,
        selectedRepoFile, deleteRepomixFile, repoUrl, setRepoUrl,
    } = useRepomixContext();

    const {
        systemPrompt, setSystemPrompt, showSystemPromptInput, setShowSystemPromptInput,
        isLoadingPrompt, isSystemPromptSaving, systemPromptMessage, handleSaveSystemPrompt,
    } = useSystemPrompt();

    const {
        availableModels, selectedModelCallName, handleModelChange: onModelChange,
        isLoadingModels, currentCallStats, totalSessionStats,
    } = useModels();

    return (
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 lg:gap-[30px] pb-6 mb-6 border-b border-[#e7eaf3]">
            <div className="flex flex-col gap-6 lg:basis-1/2 w-full">
                <div className={controlPanelBaseClasses}>
                    <RepomixForm
                        onGenerate={generateRepomixFile}
                        isGenerating={repomixIsLoading && !selectedRepoFile} // Simplified condition
                        repoUrl={repoUrl}
                        onRepoUrlChange={setRepoUrl}
                    />
                </div>
                <div className={controlPanelBaseClasses}>
                    <RepoSelector
                        repos={availableRepos}
                        onSelectRepo={loadRepoFileContent}
                        isLoading={repomixIsLoading && !availableRepos.find(r => r.filename === selectedRepoFile)} // Simplified
                        selectedValue={selectedRepoFile || ""}
                        onDeleteRepo={deleteRepomixFile}
                        isDeleting={repomixIsLoading && !!selectedRepoFile} // Simplified
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
                        onModelChange={onModelChange}
                        isLoadingModels={isLoadingModels}
                        currentCallStats={currentCallStats}
                        totalSessionStats={totalSessionStats}
                        isChatLoading={isChatLoading}
                    />
                </div>
                 {apiKeyStatus.userHasGeminiKey === false && !apiKeyStatus.apiKeyStatusLoading && (
                    <div className="text-center mb-0 p-[10px] text-[#c0392b] bg-[#fadbd8] border border-[#f1948a] rounded-md">
                        Gemini API Key is not set. Chat functionality is disabled.
                        <button onClick={apiKeyStatus.openApiKeyModal} className="ml-2 px-2 py-1 text-xs bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Set Key</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfigurationPanel;