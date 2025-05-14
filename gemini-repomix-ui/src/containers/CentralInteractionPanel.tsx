// src/containers/CentralInteractionPanel.tsx
import React from 'react';
import ConfigurationPanel from '../components/ConfigurationPanel';
import ChatInterface from '../components/ChatInterface';
import InputArea from '../components/InputArea';
import { UseApiKeyStatusReturn } from '../hooks/useApiKeyStatus'; // For apiKeyStatus prop type
import { ParsedRepomixData } from '../utils/parseRepomix';
import { ChatMessage } from '../types';

// Tailwind class constants
const statusMessageBaseClasses = "px-[15px] py-[10px] mt-[10px] rounded-md text-sm border";
const statusMessageWarningClasses = "bg-[#fdebd0] text-[#e67e22] border-[#f5cba7]";
const statusMessageErrorClasses = "bg-[#fdedec] text-[#e74c3c] border-[#f5b7b1]";
const statusMessageSuccessClasses = "bg-[#e8f8f5] text-[#1abc9c] border-[#a3e4d7]";

interface CentralInteractionPanelProps {
    apiKeyStatus: Pick<UseApiKeyStatusReturn, 'userHasGeminiKey' | 'apiKeyStatusLoading' | 'openApiKeyModal'>;
    isChatLoading: boolean;
    attachmentStatus: string | null;
    currentError: string | null;
    chatHistory: ChatMessage[];
    onStartComparison: (filePath: string, suggestedContent: string) => void;
    parsedRepomixData: ParsedRepomixData | null;
    onPromptSubmit: (promptText: string) => Promise<void>;
    onFileAttach: (file: File) => void;
    anyLoading: boolean; // Combined loading state for InputArea
    displayAttachedFileNameForInputArea: string | null;
    centerColumnClasses: string; // Classes for the outermost div of this panel
}

const CentralInteractionPanel: React.FC<CentralInteractionPanelProps> = ({
    apiKeyStatus,
    isChatLoading,
    attachmentStatus,
    currentError,
    chatHistory,
    onStartComparison,
    parsedRepomixData,
    onPromptSubmit,
    onFileAttach,
    anyLoading,
    displayAttachedFileNameForInputArea,
    centerColumnClasses,
}) => {
    const determineStatusMessageClasses = (status: string | null): string => {
        if (!status) return '';
        if (status.includes('Failed') || status.includes('non-standard') || status.includes('Error')) {
            return statusMessageWarningClasses; // Or error, depending on severity
        }
        return statusMessageSuccessClasses;
    };

    return (
        <div className={centerColumnClasses}>
            <div className="flex-grow overflow-y-auto flex flex-col gap-6 px-[20px] lg:px-[30px] pt-6 pb-6 scrollable-content-area">
                <ConfigurationPanel
                    apiKeyStatus={apiKeyStatus}
                    isChatLoading={isChatLoading}
                />

                {attachmentStatus && (
                    <div className={`${statusMessageBaseClasses} ${determineStatusMessageClasses(attachmentStatus)}`}>
                        {attachmentStatus}
                    </div>
                )}

                {currentError && (
                    <div className={`${statusMessageBaseClasses} ${statusMessageErrorClasses}`}>
                        {currentError}
                    </div>
                )}

                <ChatInterface
                    history={chatHistory}
                    onStartComparison={onStartComparison}
                    parsedRepomixData={parsedRepomixData}
                />
                {isChatLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                    <div className="px-[18px] py-3 mt-[10px] mb-[10px] rounded-md text-center flex-shrink-0 text-[#566573] italic">Thinking...</div>
                )}
            </div>

            <div className="flex-shrink-0 bg-[#f8f9fc] px-[15px] sm:px-[25px] py-3 border-t border-[#e7eaf3] shadow-[0_-2px_5px_rgba(0,0,0,0.03)] z-10">
                <InputArea
                    onPromptSubmit={onPromptSubmit}
                    onFileAttach={onFileAttach}
                    isLoading={anyLoading} // Pass the combined loading state
                    attachedFileName={displayAttachedFileNameForInputArea}
                />
            </div>
        </div>
    );
};

export default CentralInteractionPanel;