// gemini-repomix-ui/src/hooks/useAppView.ts
import { useState, useEffect, useCallback } from 'react';
import type { ComparisonViewData } from '../types';
import type { ParsedRepomixData } from '../utils/parseRepomix';

interface UseAppViewProps {
    parsedRepomixData: ParsedRepomixData | null;
    setGlobalError: (error: string | null) => void; // To set errors from comparison logic
}

export interface UseAppViewReturn {
    comparisonView: ComparisonViewData | null;
    isFullScreenView: boolean;
    toggleFullScreenView: () => void;
    startComparison: (filePath: string, suggestedContent: string) => void;
    closeComparison: () => void;
}

export function useAppView({ parsedRepomixData, setGlobalError }: UseAppViewProps): UseAppViewReturn {
    const [comparisonView, setComparisonView] = useState<ComparisonViewData | null>(null);
    const [isFullScreenView, setIsFullScreenView] = useState(false);

    useEffect(() => {
        if (!parsedRepomixData && !comparisonView) {
            setIsFullScreenView(false);
        }
    }, [parsedRepomixData, comparisonView]);

    const toggleFullScreenView = useCallback(() => {
        if (parsedRepomixData || comparisonView) {
            setIsFullScreenView(prev => !prev);
        } else {
            setIsFullScreenView(false);
        }
    }, [parsedRepomixData, comparisonView]);

    const startComparison = useCallback((filePath: string, suggestedContent: string) => {
        if (parsedRepomixData?.fileContents[filePath]) {
            setComparisonView({ filePath, originalContent: parsedRepomixData.fileContents[filePath], suggestedContent });
            setIsFullScreenView(true);
        } else {
            setGlobalError(`Original content for ${filePath} not found for comparison.`);
        }
    }, [parsedRepomixData, setGlobalError]);

    const closeComparison = useCallback(() => setComparisonView(null), []);

    return {
        comparisonView,
        isFullScreenView,
        toggleFullScreenView,
        startComparison,
        closeComparison,
    };
}