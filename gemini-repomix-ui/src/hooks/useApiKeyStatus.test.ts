// gemini-repomix-ui/src/hooks/useApiKeyStatus.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mocked, type MockedFunction } from 'vitest'; // Import Mocked
import { useApiKeyStatus } from './useApiKeyStatus';
import * as apiOriginal from '../services/api'; // Original import
import { useAuth } from '../contexts/AuthContext';

// Mock dependencies
vi.mock('../services/api'); // Mocks the entire module
vi.mock('../contexts/AuthContext');

// Cast the entire module to its Mocked type
const mockApi = apiOriginal as Mocked<typeof apiOriginal>; 
const mockUseAuth = useAuth as MockedFunction<typeof useAuth>; 

// If UseApiKeyStatusReturn is not exported, you might need to define a similar type for the hook's return for clarity,
// though renderHook infers it.

describe('useApiKeyStatus', () => {
    let mockUpdateGeminiConfig: ReturnType<typeof vi.fn>;

    // Helper to set up the default auth mock
    const setupAuthMock = (
        sessionExists: boolean,
        authIsLoading: boolean = false
    ) => {
        mockUseAuth.mockReturnValue({
            session: sessionExists ? { user: { id: 'test-user' } } : null,
            user: sessionExists ? { id: 'test-user' } : null,
            isLoading: authIsLoading,
            error: null,
            signInWithEmail: vi.fn(),
            signUpWithEmail: vi.fn(),
            signInWithGitHub: vi.fn(),
            signOut: vi.fn(),
        } as any);
    };

    beforeEach(() => {
        mockUpdateGeminiConfig = vi.fn();
        // Reset all mocks to ensure a clean state for each test
        vi.resetAllMocks();
        // Set a default auth state that usually allows API calls
        setupAuthMock(true, false);
    });

    // afterEach is not strictly needed if vi.resetAllMocks() is in beforeEach,
    // but can be kept if you have other specific cleanup.

    it('should initialize with loading true, then check API key status and update', async () => {
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: true });

        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));

        // Initial state before useEffect's async operations complete
        expect(result.current.apiKeyStatusLoading).toBe(true);
        expect(result.current.userHasGeminiKey).toBe(null);

        // Wait for the hook's async operations (checkApiKeyStatus) and state updates to complete
        await waitFor(() => {
            expect(result.current.apiKeyStatusLoading).toBe(false);
        });

        expect(result.current.userHasGeminiKey).toBe(true);
        expect(result.current.showApiKeyModal).toBe(false);
        expect(mockApi.getGeminiApiKeyStatus).toHaveBeenCalledTimes(1);
    });

    it('should show API key modal if no key is found after checking', async () => {
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: false });

        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));
        
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));

        expect(result.current.userHasGeminiKey).toBe(false);
        expect(result.current.showApiKeyModal).toBe(true);
    });

    it('should handle API error when checking status', async () => {
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: false, error: 'API down' });

        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));

        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));

        expect(result.current.userHasGeminiKey).toBe(false); // Defaults to false on error
        expect(result.current.apiKeyError).toContain('API down');
    });

    it('should not call getGeminiApiKeyStatus if no session initially', async () => {
        setupAuthMock(false, false); // No session, auth not loading
        // mockApi.getGeminiApiKeyStatus.mockClear(); // Cleared by vi.resetAllMocks() in beforeEach

        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));

        // The useEffect runs, checkApiKeyStatus is called.
        // Inside checkApiKeyStatus, with session: null, the API call should be skipped.
        // The hook should quickly transition out of its initial loading state.
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));

        expect(mockApi.getGeminiApiKeyStatus).not.toHaveBeenCalled();
        expect(result.current.userHasGeminiKey).toBe(null);
    });

    it('should not call getGeminiApiKeyStatus if auth is initially loading', async () => {
        setupAuthMock(true, true); // Has session, but auth is loading
        // mockApi.getGeminiApiKeyStatus.mockClear();

        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));
        
        // No need to waitFor apiKeyStatusLoading to be false here, as it should remain true
        // We can yield to the event loop to ensure any initial synchronous parts of useEffect run
        await act(async () => {}); 

        expect(mockApi.getGeminiApiKeyStatus).not.toHaveBeenCalled();
        expect(result.current.apiKeyStatusLoading).toBe(true); // Remains true because auth is loading
        expect(result.current.userHasGeminiKey).toBe(null);
    });


    it('should handle API key submission successfully', async () => {
        // 1. Initial state: no key
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: false }); // For initial check
        
        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));
        
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));
        expect(result.current.showApiKeyModal).toBe(true);

        // 2. Submission: now has key
        // Mock for the getGeminiApiKeyStatus call inside handleApiKeySubmittedInModal
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: true }); 
        
        await act(async () => {
            result.current.handleApiKeySubmittedInModal();
        });
        
        // Wait for the submission logic (which includes an API call and state updates) to complete
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));

        expect(result.current.userHasGeminiKey).toBe(true);
        expect(result.current.showApiKeyModal).toBe(false);
        expect(mockUpdateGeminiConfig).toHaveBeenCalledTimes(1);
        expect(result.current.apiKeyError).toBe(null);
        expect(mockApi.getGeminiApiKeyStatus).toHaveBeenCalledTimes(2); // Once initially, once in handler
    });

    it('should handle API key submission when status re-check still shows no key', async () => {
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: false }); // Initial
        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));

        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: false }); // After submission
        
        await act(async () => {
            result.current.handleApiKeySubmittedInModal();
        });
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));
        
        expect(result.current.userHasGeminiKey).toBe(false);
        expect(result.current.apiKeyError).toContain("API key submitted, but status still shows no key.");
        expect(mockUpdateGeminiConfig).not.toHaveBeenCalled();
    });
    
    it('should handle API error during key submission re-check', async () => {
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: false }); // Initial
        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));

        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: false, error: "Re-check failed" }); // After submission
        
        await act(async () => {
            result.current.handleApiKeySubmittedInModal();
        });
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false));
        
        expect(result.current.userHasGeminiKey).toBe(false); // Stays false as re-check failed
        expect(result.current.apiKeyError).toContain("Error re-checking API key status: Re-check failed");
    });


    it('should open and close modal via exposed functions', async () => {
        mockApi.getGeminiApiKeyStatus.mockResolvedValueOnce({ success: true, hasKey: true });
        const { result } = renderHook(() => useApiKeyStatus({ updateGeminiConfig: mockUpdateGeminiConfig }));
        
        await waitFor(() => expect(result.current.apiKeyStatusLoading).toBe(false)); 
        expect(result.current.showApiKeyModal).toBe(false); // Initially false if key exists

        act(() => {
            result.current.openApiKeyModal();
        });
        expect(result.current.showApiKeyModal).toBe(true);

        act(() => {
            result.current.closeApiKeyModal();
        });
        expect(result.current.showApiKeyModal).toBe(false);
    });
});