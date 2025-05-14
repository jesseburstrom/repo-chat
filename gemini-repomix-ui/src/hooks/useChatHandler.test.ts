// gemini-repomix-ui/src/hooks/useChatHandler.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
// Import 'vi' itself if you need to access its methods like vi.fn()
// Import specific types like 'Mocked' if you need them for type annotations.
import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest'; 
import { useChatHandler, UseChatHandlerProps } from './useChatHandler';
import * as apiOriginal from '../services/api'; // Keep original name for clarity
import type { ParsedRepomixData } from '../utils/parseRepomix';
import type { TokenStats } from '../types';

// Mock dependencies
vi.mock('../services/api');

// Use the imported Mocked type
const mockApi = apiOriginal as Mocked<typeof apiOriginal>; 


const mockParsedData: ParsedRepomixData = {
    directoryStructure: ['file1.ts'],
    fileContents: { 'file1.ts': 'content1' },
};

// Define the function signatures as types
type OpenApiKeyModalFn = () => void;
type RecordCallStatsFn = (stats: TokenStats) => void;
type ResetCurrentCallStatsFn = () => void;

describe('useChatHandler', () => {
    // Helper to create fresh props with new, typed vi.fn() instances for each test
    const getFreshProps = (): UseChatHandlerProps => ({
        userHasGeminiKey: true,
        apiKeyStatusLoading: false,
        openApiKeyModal: vi.fn<OpenApiKeyModalFn>(),         // Pass the function signature type
        parsedRepomixData: null,
        selectedRepoFile: null,
        promptSelectedFilePaths: [],
        selectedModelCallName: 'test-model',
        recordCallStats: vi.fn<RecordCallStatsFn>(),         // Pass the function signature type
        resetCurrentCallStats: vi.fn<ResetCurrentCallStatsFn>(), // Pass the function signature type
    });

    let currentTestProps: UseChatHandlerProps;

    beforeEach(() => {
        vi.resetAllMocks();
        currentTestProps = getFreshProps();
    });

    // ... (rest of your tests remain the same, they will use currentTestProps directly) ...

    it('should initialize with empty chat history and not loading', () => {
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        expect(result.current.chatHistory).toEqual([]);
        expect(result.current.chatIsLoading).toBe(false);
        expect(result.current.chatError).toBe(null);
    });

    it('should not submit prompt if API key is not set and open modal', async () => {
        currentTestProps.userHasGeminiKey = false;
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        
        await act(async () => {
            await result.current.submitPrompt('Test prompt');
        });

        expect(result.current.chatError).toContain('API Key is not set');
        expect(currentTestProps.openApiKeyModal).toHaveBeenCalledTimes(1);
        expect(mockApi.callGemini).not.toHaveBeenCalled();
    });

    it('should not submit an empty prompt if no file context exists', async () => {
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        await act(async () => {
            await result.current.submitPrompt('   ');
        });
        expect(result.current.chatError).toContain('type a prompt, attach a file, or select files');
        expect(mockApi.callGemini).not.toHaveBeenCalled();
    });

    it('should submit prompt, add user message, call API successfully, and record stats', async () => {
        const mockApiResponse = { 
            success: true, 
            text: 'Model response',
            inputTokens: 10,
            outputTokens: 20,
            totalCost: 0.05,
            modelUsed: 'test-model-from-api'
        };
        mockApi.callGemini.mockResolvedValue(mockApiResponse);

        const { result } = renderHook(() => useChatHandler(currentTestProps));
        const promptText = 'Hello model';

        await act(async () => {
            await result.current.submitPrompt(promptText);
        });
        
        await waitFor(() => expect(result.current.chatIsLoading).toBe(false));

        expect(result.current.chatError).toBe(null);
        expect(result.current.chatHistory.length).toBe(2);
        expect(result.current.chatHistory[0]).toEqual({ role: 'user', parts: [{ text: promptText }] });
        expect(result.current.chatHistory[1]).toEqual({ role: 'model', parts: [{ text: 'Model response' }] });
        
        expect(mockApi.callGemini).toHaveBeenCalledWith(expect.objectContaining({ 
            newMessage: expect.stringContaining(promptText),
            modelCallName: 'test-model'
        }));
        expect(currentTestProps.resetCurrentCallStats).toHaveBeenCalledTimes(1);
        
        expect(currentTestProps.recordCallStats).toHaveBeenCalledTimes(1);
        expect(currentTestProps.recordCallStats).toHaveBeenCalledWith({
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30, 
            inputCost: 0,    
            outputCost: 0,   
            totalCost: 0.05,
            modelUsed: 'test-model-from-api',
        });
    });

    it('should include selected file context in the prompt to API', async () => {
        mockApi.callGemini.mockResolvedValue({ 
            success: true, text: 'Response with file context',
            inputTokens: 5, outputTokens: 5, totalCost: 0.01
        });
        currentTestProps.parsedRepomixData = mockParsedData;
        currentTestProps.promptSelectedFilePaths = ['file1.ts'];
        
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        const promptText = 'Analyze this file';

        await act(async () => {
            await result.current.submitPrompt(promptText);
        });
        await waitFor(() => expect(result.current.chatIsLoading).toBe(false));

        expect(mockApi.callGemini).toHaveBeenCalledWith(expect.objectContaining({
            newMessage: expect.stringContaining('<file path="file1.ts">\ncontent1\n</file>')
        }));
        expect(result.current.chatHistory.length).toBe(2);
        expect(result.current.chatHistory[0].parts[0].text).toBe(promptText); 
    });
    
    it('should use context descriptor if prompt is empty but files are selected', async () => {
        mockApi.callGemini.mockResolvedValue({ 
            success: true, text: 'Analyzed files',
            inputTokens: 1, outputTokens: 1, totalCost: 0.001
        });
        currentTestProps.parsedRepomixData = mockParsedData;
        currentTestProps.promptSelectedFilePaths = ['file1.ts'];

        const { result } = renderHook(() => useChatHandler(currentTestProps));

        await act(async () => {
            await result.current.submitPrompt(''); 
        });
        await waitFor(() => expect(result.current.chatIsLoading).toBe(false));
        
        expect(result.current.chatHistory[0].parts[0].text).toBe('(Using 1 selected files)');
        expect(mockApi.callGemini).toHaveBeenCalledWith(expect.objectContaining({
            newMessage: expect.stringContaining('User Prompt: Please analyze the (Using 1 selected files).')
        }));
    });

    it('should handle API call failure and revert user message', async () => {
        mockApi.callGemini.mockResolvedValue({ success: false, error: 'API Error' });
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        const promptText = 'This will fail';

        await act(async () => {
            await result.current.submitPrompt(promptText);
        });
        await waitFor(() => expect(result.current.chatIsLoading).toBe(false));

        expect(result.current.chatError).toContain('API Error');
        expect(result.current.chatHistory.length).toBe(0);
        expect(currentTestProps.recordCallStats).not.toHaveBeenCalled();
    });

    it('should open API key modal on specific API errors', async () => {
        mockApi.callGemini.mockResolvedValue({ success: false, error: 'Invalid API key' });
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        
        await act(async () => {
            await result.current.submitPrompt('test');
        });
        await waitFor(() => expect(result.current.chatIsLoading).toBe(false));

        expect(currentTestProps.openApiKeyModal).toHaveBeenCalledTimes(1);
    });

    it('should clear chat error', async () => {
        const { result } = renderHook(() => useChatHandler(currentTestProps));
        
        await act(async () => {
           await result.current.submitPrompt(''); 
        });
        await waitFor(() => expect(result.current.chatError).not.toBe(null));

        act(() => { 
            result.current.clearChatError();
        });
        expect(result.current.chatError).toBe(null);
    });
});