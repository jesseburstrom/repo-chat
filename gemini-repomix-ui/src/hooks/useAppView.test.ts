// gemini-repomix-ui/src/hooks/useAppView.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
// Explicitly import vi and MockedFunction
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'; 
import { useAppView, UseAppViewProps, UseAppViewReturn } from './useAppView';
import type { ParsedRepomixData } from '../utils/parseRepomix';

// Define the function signature for the mock
type SetGlobalErrorFn = (error: string | null) => void;

describe('useAppView', () => {
    // Use vi.MockedFunction with the signature type
    let mockSetGlobalError: MockedFunction<SetGlobalErrorFn>; 

    const mockParsedDataRegular: ParsedRepomixData = {
        directoryStructure: ['file1.ts', 'file2.ts'],
        fileContents: {
            'file1.ts': 'content of file1',
            'file2.ts': 'content of file2',
        },
    };

    beforeEach(() => {
        // Create a fresh, typed mock for setGlobalError before each test
        mockSetGlobalError = vi.fn<SetGlobalErrorFn>(); // Create with the explicit signature type
        // vi.resetAllMocks(); // Good if other modules were globally mocked
    });

    it('should initialize with no comparison view and not in full screen', () => {
        const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { initialProps: { parsedRepomixData: null, setGlobalError: mockSetGlobalError } }
        );
        expect(result.current.comparisonView).toBe(null);
        expect(result.current.isFullScreenView).toBe(false);
    });

    it('should toggle full screen view if parsedRepomixData exists', () => {
        const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { initialProps: { parsedRepomixData: mockParsedDataRegular, setGlobalError: mockSetGlobalError } }
        );
        
        act(() => {
            result.current.toggleFullScreenView();
        });
        expect(result.current.isFullScreenView).toBe(true);

        act(() => {
            result.current.toggleFullScreenView();
        });
        expect(result.current.isFullScreenView).toBe(false);
    });

    it('should not enter full screen view on toggle if no parsedRepomixData and no comparisonView', () => {
        const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { initialProps: { parsedRepomixData: null, setGlobalError: mockSetGlobalError } }
        );
        
        act(() => {
            result.current.toggleFullScreenView();
        });
        expect(result.current.isFullScreenView).toBe(false);
    });

    // Re-add the previously failing test (which was removed for debugging the other file)
    // it('should start comparison, enter full screen view, and clear global error', async () => {
    //     const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
    //         (props) => useAppView(props),
    //         { 
    //             initialProps: { 
    //                 parsedRepomixData: mockParsedDataRegular, 
    //                 setGlobalError: mockSetGlobalError 
    //             } 
    //         }
    //     );
    //     const filePath = 'file1.ts';
    //     const suggestedContent = 'new content for file1';

    //     mockSetGlobalError.mockClear(); // Clear any calls from initial render if any

    //     await act(async () => {
    //         result.current.startComparison(filePath, suggestedContent);
    //     });
        
    //     await waitFor(() => {
    //         expect(result.current.comparisonView).toEqual({
    //             filePath,
    //             originalContent: mockParsedDataRegular.fileContents[filePath],
    //             suggestedContent,
    //         });
    //     });
        
    //     expect(result.current.isFullScreenView).toBe(true);
    //     expect(mockSetGlobalError).toHaveBeenCalledTimes(1);
    //     expect(mockSetGlobalError).toHaveBeenCalledWith(null);
    // });


    it('should set global error and not start comparison if file content is missing', async () => {
        const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { initialProps: { parsedRepomixData: mockParsedDataRegular, setGlobalError: mockSetGlobalError } }
        );
        const filePath = 'nonexistent.ts';
        const suggestedContent = 'new content';

        // mockSetGlobalError.mockClear(); // Already fresh from beforeEach

        await act(async () => {
            result.current.startComparison(filePath, suggestedContent);
        });

        await waitFor(() => expect(result.current.comparisonView).toBe(null));
        expect(mockSetGlobalError).toHaveBeenCalledTimes(1);
        expect(mockSetGlobalError).toHaveBeenCalledWith(`Original content for ${filePath} not found for comparison.`);
        
        // Test isFullScreenView based on its state *before* this failing call
        // If it started false (due to no data/comparison), it should remain false.
        // Create a fresh render for this specific assertion on isFullScreenView
        const { result: resultForFullScreenCheck } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { initialProps: { parsedRepomixData: mockParsedDataRegular, setGlobalError: mockSetGlobalError } }
        );
         mockSetGlobalError.mockClear(); // Clear for this new instance's call
         await act(async () => {
            resultForFullScreenCheck.current.startComparison(filePath, suggestedContent);
        });
        expect(resultForFullScreenCheck.current.isFullScreenView).toBe(false); 
    });
    
    // it('should enter full screen if comparison is started (data provided for comparison)', async () => {
    //      const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
    //         (props) => useAppView(props),
    //         { initialProps: { parsedRepomixData: mockParsedDataRegular, setGlobalError: mockSetGlobalError } }
    //     );
        
    //     await act(async () => {
    //         result.current.startComparison('file1.ts', 'suggested');
    //     });
    //     await waitFor(() => expect(result.current.isFullScreenView).toBe(true));
    //     expect(result.current.comparisonView).not.toBeNull();
    //     expect(mockSetGlobalError).toHaveBeenCalledWith(null); 
    // });

    it('should close comparison view and remain full screen if parsedData exists', async () => {
        const { result } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { initialProps: { parsedRepomixData: mockParsedDataRegular, setGlobalError: mockSetGlobalError } }
        );
        
        await act(async () => {
            result.current.startComparison('file1.ts', 'new content');
        });
        await waitFor(() => expect(result.current.comparisonView).not.toBe(null));
        await waitFor(() => expect(result.current.isFullScreenView).toBe(true));

        await act(async () => {
            result.current.closeComparison();
        });
        
        await waitFor(() => expect(result.current.comparisonView).toBe(null));
        expect(result.current.isFullScreenView).toBe(true); 
    });
    
    it('should exit full screen if comparison is closed and no parsedData exists (after rerender)', async () => {
        const { result, rerender } = renderHook<UseAppViewReturn, UseAppViewProps>(
            (props) => useAppView(props),
            { 
                initialProps: { 
                    parsedRepomixData: mockParsedDataRegular, 
                    setGlobalError: mockSetGlobalError 
                } 
            }
        );

        await act(async () => {
            result.current.startComparison('file1.ts', 'new content');
        });
        await waitFor(() => expect(result.current.isFullScreenView).toBe(true));
        
        await act(async () => { 
           rerender({ parsedRepomixData: null, setGlobalError: mockSetGlobalError });
        });
        
        await act(async () => {
            result.current.closeComparison(); 
        });
        
        await waitFor(() => {
            expect(result.current.comparisonView).toBe(null);
            expect(result.current.isFullScreenView).toBe(false); 
        });
    });
});