// src/hooks/useModels.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchGeminiConfig as apiFetchGeminiConfig } from '../services/api';
import type { ClientGeminiModelInfo, TokenStats } from '../ModelSettings'; // Adjust path

export function useModels(initialDefaultModelCallName?: string) {
    const [availableModels, setAvailableModels] = useState<ClientGeminiModelInfo[]>([]);
    const [selectedModelCallName, setSelectedModelCallName] = useState<string>(initialDefaultModelCallName || '');
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
    const [modelError, setModelError] = useState<string | null>(null); // For model loading errors

    const [currentCallStats, setCurrentCallStats] = useState<TokenStats | null>(null);
    const [totalSessionStats, setTotalSessionStats] = useState<TokenStats>({
        inputTokens: 0, outputTokens: 0, totalTokens: 0,
        inputCost: 0, outputCost: 0, totalCost: 0,
    });

    const updateGeminiConfig = useCallback(async () => {
        setIsLoadingModels(true);
        setModelError(null);
        const result = await apiFetchGeminiConfig();
        if (result.success) {
            setAvailableModels(result.models || []);
            if (result.currentModelCallName) {
                setSelectedModelCallName(result.currentModelCallName);
            } else if (result.models && result.models.length > 0 && !selectedModelCallName) {
                setSelectedModelCallName(result.models[0].callName);
            }
        } else {
            setModelError("Could not load AI model configurations. " + (result.error || "Unknown error."));
            setAvailableModels([]);
        }
        setIsLoadingModels(false);
    }, [selectedModelCallName]); // Re-fetch if selectedModelCallName was potentially uninitialized and then set

    useEffect(() => {
        updateGeminiConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Initial fetch

    const handleModelChange = (newModelCallName: string) => {
        setSelectedModelCallName(newModelCallName);
        // Optionally, you might want to persist this change to the backend immediately
        // or let the backend update it after a successful call-gemini using this model.
    };

    const recordCallStats = (stats: TokenStats) => {
        setCurrentCallStats(stats);
        setTotalSessionStats(prev => ({
            inputTokens: prev.inputTokens + (stats.inputTokens || 0),
            outputTokens: prev.outputTokens + (stats.outputTokens || 0),
            totalTokens: prev.totalTokens + ((stats.inputTokens || 0) + (stats.outputTokens || 0)),
            inputCost: prev.inputCost + (stats.inputCost || 0),
            outputCost: prev.outputCost + (stats.outputCost || 0),
            totalCost: prev.totalCost + (stats.totalCost || 0),
            modelUsed: prev.modelUsed // Or update if modelUsed in stats is different
        }));
        if (stats.modelUsed && stats.modelUsed !== selectedModelCallName) {
            setSelectedModelCallName(stats.modelUsed); // Sync with model actually used
        }
    };
    
    const resetCurrentCallStats = () => setCurrentCallStats(null);

    return {
        availableModels,
        selectedModelCallName,
        isLoadingModels,
        modelError, // Expose model specific error
        handleModelChange,
        currentCallStats,
        totalSessionStats,
        recordCallStats,
        resetCurrentCallStats,
        updateGeminiConfig // Expose if manual refresh is needed
    };
}