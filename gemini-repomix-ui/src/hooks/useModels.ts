// src/hooks/useModels.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchGeminiConfig as apiFetchGeminiConfig } from '../services/api';
import type { ClientGeminiModelInfo, TokenStats } from '../ModelSettings'; // Adjust path if needed
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export function useModels(initialDefaultModelCallName?: string) {
    const { session, isLoading: authIsLoading } = useAuth(); // Get auth state

    const [availableModels, setAvailableModels] = useState<ClientGeminiModelInfo[]>([]);
    const [selectedModelCallName, setSelectedModelCallName] = useState<string>(initialDefaultModelCallName || '');
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false); // Start as false, true only during fetch
    const [modelError, setModelError] = useState<string | null>(null);

    const [currentCallStats, setCurrentCallStats] = useState<TokenStats | null>(null);
    const [totalSessionStats, setTotalSessionStats] = useState<TokenStats>({
        inputTokens: 0, outputTokens: 0, totalTokens: 0,
        inputCost: 0, outputCost: 0, totalCost: 0,
    });

    const updateGeminiConfig = useCallback(async () => {
        // Only fetch if authenticated and auth process is complete
        if (!session || authIsLoading) {
            // console.log('[useModels] Skipping fetchGeminiConfig: Not authenticated or auth is loading.');
            setAvailableModels([]); // Clear any existing models
            setSelectedModelCallName(initialDefaultModelCallName || ''); // Reset selected model
            setIsLoadingModels(false); // Not loading if not fetching
            setModelError(null); // Clear previous errors
            return;
        }

        setIsLoadingModels(true);
        setModelError(null);
        // console.log('[useModels] Fetching Gemini config...');
        const result = await apiFetchGeminiConfig();
        if (result.success) {
            setAvailableModels(result.models || []);
            if (result.currentModelCallName) {
                setSelectedModelCallName(result.currentModelCallName);
            } else if (result.models && result.models.length > 0 && (!selectedModelCallName || !result.models.find(m => m.callName === selectedModelCallName))) {
                // If current selection is invalid or not set, pick the first available
                setSelectedModelCallName(result.models[0].callName);
            } else if (!result.models || result.models.length === 0) {
                setSelectedModelCallName(initialDefaultModelCallName || ''); // Fallback if no models
            }
        } else {
            setModelError("Could not load AI model configurations. " + (result.error || "Unknown error."));
            setAvailableModels([]);
            setSelectedModelCallName(initialDefaultModelCallName || ''); // Reset on error
        }
        setIsLoadingModels(false);
    }, [session, authIsLoading, selectedModelCallName, initialDefaultModelCallName]);

    useEffect(() => {
        // updateGeminiConfig will be called when session or authIsLoading changes,
        // and it contains the logic to decide whether to fetch.
        updateGeminiConfig();
    }, [updateGeminiConfig]); // Dependency on the memoized callback

    const handleModelChange = (newModelCallName: string) => {
        setSelectedModelCallName(newModelCallName);
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
            modelUsed: prev.modelUsed
        }));
        if (stats.modelUsed && stats.modelUsed !== selectedModelCallName) {
            setSelectedModelCallName(stats.modelUsed);
        }
    };
    
    const resetCurrentCallStats = () => setCurrentCallStats(null);

    return {
        availableModels,
        selectedModelCallName,
        isLoadingModels,
        modelError,
        handleModelChange,
        currentCallStats,
        totalSessionStats,
        recordCallStats,
        resetCurrentCallStats,
        updateGeminiConfig
    };
}