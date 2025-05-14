// gemini-repomix-ui/src/hooks/useChatHandler.ts
import { useState, useCallback } from 'react';
import * as api from '../services/api';
import type { ChatMessage, TokenStats } from '../types';
import type { ParsedRepomixData } from '../utils/parseRepomix';

const MAX_HISTORY_TURNS = 10; // Max turns of history (user + model = 1 turn) sent to API

interface UseChatHandlerProps {
    userHasGeminiKey: boolean | null;
    apiKeyStatusLoading: boolean;
    openApiKeyModal: () => void;
    parsedRepomixData: ParsedRepomixData | null;
    selectedRepoFile: string | null; // From RepomixContext
    promptSelectedFilePaths: string[]; // From RepomixContext
    selectedModelCallName: string; // From useModels
    recordCallStats: (stats: TokenStats) => void; // From useModels
    resetCurrentCallStats: () => void; // From useModels
}

export interface UseChatHandlerReturn {
    chatHistory: ChatMessage[];
    chatIsLoading: boolean;
    chatError: string | null;
    submitPrompt: (promptText: string) => Promise<void>;
    clearChatError: () => void;
}

export function useChatHandler({
    userHasGeminiKey,
    apiKeyStatusLoading,
    openApiKeyModal,
    parsedRepomixData,
    selectedRepoFile,
    promptSelectedFilePaths,
    selectedModelCallName,
    recordCallStats,
    resetCurrentCallStats,
}: UseChatHandlerProps): UseChatHandlerReturn {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatIsLoading, setChatIsLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const clearChatError = useCallback(() => setChatError(null), []);

    const submitPrompt = useCallback(async (prompt: string) => {
        if (userHasGeminiKey === false) {
            setChatError("Gemini API Key is not set. Please set your API key.");
            openApiKeyModal();
            return;
        }
        if (userHasGeminiKey === null && !apiKeyStatusLoading) {
            setChatError("Could not verify API key status. Please try again or set your key.");
            openApiKeyModal();
            return;
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
        } else if (currentAttachedFileName) {
             contextDescriptor = `(Regarding file: ${currentAttachedFileName})`;
        }

        let combinedPromptForApi = "";
        if (filesToIncludeInPromptSegment) {
            combinedPromptForApi += `Context from selected repository files:\n${filesToIncludeInPromptSegment}\n\n`;
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
            if (errorMessage.toLowerCase().includes("api key") || errorMessage.toLowerCase().includes("permission_denied") || result.error?.includes("402") || result.error?.includes("403")) {
                // This logic might now live in useApiKeyStatus or be handled by its effects
                // For now, we call openApiKeyModal directly.
                openApiKeyModal();
            }
            setChatHistory(prev => prev.slice(0, -1)); // Revert user message on error
        }
        setChatIsLoading(false);

    }, [
        userHasGeminiKey, apiKeyStatusLoading, openApiKeyModal,
        parsedRepomixData, selectedRepoFile, promptSelectedFilePaths,
        selectedModelCallName, recordCallStats, resetCurrentCallStats,
        chatHistory // Add chatHistory here
    ]);

    return {
        chatHistory,
        chatIsLoading,
        chatError,
        submitPrompt,
        clearChatError,
    };
}