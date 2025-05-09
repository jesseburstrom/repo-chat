// src/hooks/useModels.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchGeminiConfig as apiFetchGeminiConfig } from '../services/api';
import type { ClientGeminiModelInfo, TokenStats } from '../ModelSettings';
import { useAuth } from '../contexts/AuthContext';

export function useModels(initialDefaultModelCallNameProp?: string) { // Renamed for clarity
    const { session, isLoading: authIsLoading } = useAuth();

    const [availableModels, setAvailableModels] = useState<ClientGeminiModelInfo[]>([]);
    const [selectedModelCallName, setSelectedModelCallName] = useState<string>(''); // Start empty or with prop
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [isInitialModelLoadComplete, setIsInitialModelLoadComplete] = useState(false); // Track initial load

    const [currentCallStats, setCurrentCallStats] = useState<TokenStats | null>(null);
    const [totalSessionStats, setTotalSessionStats] = useState<TokenStats>({
        inputTokens: 0, outputTokens: 0, totalTokens: 0,
        inputCost: 0, outputCost: 0, totalCost: 0,
    });

    // This function is responsible for fetching models and determining the selection,
    // especially on initial load or when a full refresh is needed.
    const loadAndSetModelsConfiguration = useCallback(async (isManualRefresh = false) => {
        if (!session || authIsLoading) {
            setAvailableModels([]);
            setSelectedModelCallName(initialDefaultModelCallNameProp || '');
            setIsLoadingModels(false);
            setModelError(null);
            if (!isManualRefresh) setIsInitialModelLoadComplete(false); // Reset if auth changes
            return;
        }

        // If it's not a manual refresh and the initial load is already done,
        // we don't necessarily need to refetch unless other dependencies change.
        // However, this function is now primarily for initial load or explicit refresh.
        if (!isManualRefresh && isInitialModelLoadComplete) {
             // console.log('[useModels] Initial load already complete, skipping auto-refetch of models config unless dependencies changed.');
            // return; // This line might prevent updates if session/authIsLoading changes *after* initial load.
                     // Let's allow it to run if session/authIsLoading changes.
        }


        setIsLoadingModels(true);
        setModelError(null);
        // console.log(`[useModels] Fetching Gemini config. ManualRefresh: ${isManualRefresh}, InitialLoadDone: ${isInitialModelLoadComplete}`);
        const result = await apiFetchGeminiConfig();
        // console.log('[useModels] Fetched Gemini config result:', result);

        if (result.success) {
            const newAvailModels = result.models || [];
            setAvailableModels(newAvailModels);

            let newSelectionCandidate = '';

            // Determine the model to select:
            // 1. If it's a manual refresh OR initial load, prioritize backend's current model.
            // 2. Otherwise (e.g., user changed selection, then auth changed), try to preserve valid user selection.
            if (isManualRefresh || !isInitialModelLoadComplete) {
                if (result.currentModelCallName && newAvailModels.find(m => m.callName === result.currentModelCallName)) {
                    newSelectionCandidate = result.currentModelCallName;
                }
            } else {
                // Not a manual refresh and initial load was done. Try to keep current valid selection.
                if (selectedModelCallName && newAvailModels.find(m => m.callName === selectedModelCallName)) {
                    newSelectionCandidate = selectedModelCallName;
                } else if (result.currentModelCallName && newAvailModels.find(m => m.callName === result.currentModelCallName)) {
                    // Fallback to backend's if current local became invalid
                    newSelectionCandidate = result.currentModelCallName;
                }
            }

            // If still no candidate, pick first available or prop default
            if (!newSelectionCandidate) {
                if (newAvailModels.length > 0) {
                    newSelectionCandidate = newAvailModels[0].callName;
                } else {
                    newSelectionCandidate = initialDefaultModelCallNameProp || '';
                }
            }
            // console.log('[useModels] Setting selected model to:', newSelectionCandidate);
            setSelectedModelCallName(newSelectionCandidate);

        } else {
            setModelError("Could not load AI model configurations. " + (result.error || "Unknown error."));
            setAvailableModels([]);
            setSelectedModelCallName(initialDefaultModelCallNameProp || ''); // Reset on error
        }
        setIsLoadingModels(false);
        if (!isInitialModelLoadComplete) setIsInitialModelLoadComplete(true);

    // Removed selectedModelCallName from here to prevent re-fetch on user selection.
    // It should refetch if session, authIsLoading, or the prop changes.
    }, [session, authIsLoading, initialDefaultModelCallNameProp, isInitialModelLoadComplete, selectedModelCallName]); // Keeping selectedModelCallName for now to see if the internal logic handles it. Ideally, it would be removed.
                                                                                                   // After testing, if the problem persists, REMOVING selectedModelCallName from this useCallback's deps is the next step.

    useEffect(() => {
        // This effect runs on initial mount and when session/authIsLoading changes.
        // It calls the function that loads models and sets the initial/default selection.
        // console.log(`[useModels] Main useEffect triggered. InitialLoadComplete: ${isInitialModelLoadComplete}`);
        loadAndSetModelsConfiguration(false); // false indicates it's not a manual refresh
    }, [loadAndSetModelsConfiguration]); // Now depends on the memoized function


    const handleModelChange = (newModelFromUI: string) => {
        // console.log('[useModels] handleModelChange: User selected:', newModelFromUI);
        // User explicitly changes the model. Just update the state.
        // Do NOT trigger a refetch of the config here.
        setSelectedModelCallName(newModelFromUI);
    };

    const recordCallStats = (stats: TokenStats) => {
        setCurrentCallStats(stats);
        setTotalSessionStats(prev => ({ /* ...your stats update logic... */
            inputTokens: prev.inputTokens + (stats.inputTokens || 0),
            outputTokens: prev.outputTokens + (stats.outputTokens || 0),
            totalTokens: prev.totalTokens + ((stats.inputTokens || 0) + (stats.outputTokens || 0)),
            inputCost: prev.inputCost + (stats.inputCost || 0),
            outputCost: prev.outputCost + (stats.outputCost || 0),
            totalCost: prev.totalCost + (stats.totalCost || 0),
            modelUsed: prev.modelUsed // Or update if modelUsed in stats is different
        }));

        // If the backend used a different model than selected, and it's valid, update local state.
        if (stats.modelUsed && stats.modelUsed !== selectedModelCallName && availableModels.find(m => m.callName === stats.modelUsed)) {
            // console.log(`[useModels] recordCallStats: Model used in API call (${stats.modelUsed}) differs from local. Updating local to ${stats.modelUsed}.`);
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
        updateGeminiConfig: () => loadAndSetModelsConfiguration(true) // Expose for manual refresh
    };
}