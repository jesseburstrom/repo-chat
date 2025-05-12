// src/hooks/useModels.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchGeminiConfig as apiFetchGeminiConfig } from '../services/api';
import type { ClientGeminiModelInfo, TokenStats } from '../ModelSettings';
import { useAuth } from '../contexts/AuthContext';
// It's better practice to import the default from a shared location if possible,
// but importing from backend might be complex. Define it here or in a shared constants file.
// For now, let's hardcode it as a fallback based on previous backend setup.
const DEFAULT_MODEL_FALLBACK = "gemini-2.5-pro-preview-05-06";

export function useModels(initialDefaultModelCallNameProp?: string) { // Keep prop as ultimate fallback
    const { session, isLoading: authIsLoading } = useAuth();

    const [availableModels, setAvailableModels] = useState<ClientGeminiModelInfo[]>([]);
    // Initialize with the prop or the hardcoded fallback, fetch will overwrite
    const initialModel = initialDefaultModelCallNameProp || DEFAULT_MODEL_FALLBACK;
    const [selectedModelCallName, setSelectedModelCallName] = useState<string>(initialModel);
    const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true); // Start true
    const [modelError, setModelError] = useState<string | null>(null);
    const [isInitialModelLoadDone, setIsInitialModelLoadDone] = useState(false);


    const [currentCallStats, setCurrentCallStats] = useState<TokenStats | null>(null);
    const [totalSessionStats, setTotalSessionStats] = useState<TokenStats>({
        inputTokens: 0, outputTokens: 0, totalTokens: 0,
        inputCost: 0, outputCost: 0, totalCost: 0,
    });

    const loadAndSetModelsConfiguration = useCallback(async (isManualRefresh = false) => {
        // If no session or still loading auth, wait or clear state.
        if (!session || authIsLoading) {
             console.log('[useModels] Waiting for auth or no session.');
             setAvailableModels([]);
             setSelectedModelCallName(initialModel); // Reset to default if auth lost
             setIsLoadingModels(!authIsLoading); // Stop loading if auth done and no session. If auth loading, keep loading.
             setModelError(null);
             setIsInitialModelLoadDone(false); // Reset initial load flag
             return;
        }

        // Avoid redundant fetches if initial load done and not manual refresh
        // Re-enabled fetching on auth change even if initial load done previously.
        // if (!isManualRefresh && isInitialModelLoadDone) {
        //      console.log('[useModels] Initial load done, skipping auto-refetch.');
        //      return;
        // }

        console.log(`[useModels] Fetching Gemini config (Auth complete: ${!!session}, Manual: ${isManualRefresh})`);
        setIsLoadingModels(true);
        setModelError(null);
        const result = await apiFetchGeminiConfig(); // This now requires auth
         console.log('[useModels] Fetched Gemini config result:', result);

        if (result.success) {
            const newAvailModels = result.models || [];
            setAvailableModels(newAvailModels);

            // Select model: Backend's value (user pref or default) is the primary source now
            const backendProvidedModel = result.currentModelCallName;
            let modelToSet = initialModel; // Start with ultimate default

            if (backendProvidedModel && newAvailModels.find(m => m.callName === backendProvidedModel)) {
                 modelToSet = backendProvidedModel;
            } else if (newAvailModels.length > 0) {
                 // Fallback if backend model is invalid/missing but models exist
                 modelToSet = newAvailModels[0].callName;
            } else {
                // If no models available, stick to initialModel (fallback)
                 console.warn('[useModels] No available models received from backend.');
                 modelToSet = initialModel;
            }
             console.log(`[useModels] Setting selected model to: ${modelToSet} (Backend provided: ${backendProvidedModel})`);
            setSelectedModelCallName(modelToSet);

        } else {
            // Handle API call failure (e.g., auth error handled by api.ts, or other server issues)
            setModelError("Could not load AI model configurations. " + (result.error || "Unknown error."));
            setAvailableModels([]);
            setSelectedModelCallName(initialModel); // Reset on error
        }
        setIsLoadingModels(false);
         if (!isInitialModelLoadDone) setIsInitialModelLoadDone(true); // Mark initial load complete

    // Dependencies: session status, auth loading status trigger the fetch
    // initialModel is only a fallback value, not a trigger itself.
    }, [session, authIsLoading, initialModel, isInitialModelLoadDone]); // isInitialModelLoadDone removed to allow fetch on auth change

    useEffect(() => {
         // This effect runs when auth state potentially changes.
         // loadAndSetModelsConfiguration checks internally if fetch is needed.
         loadAndSetModelsConfiguration(false); // Not a manual refresh
    }, [loadAndSetModelsConfiguration]); // Depend only on the memoized function


    const handleModelChange = (newModelFromUI: string) => {
         console.log('[useModels] UI selected model:', newModelFromUI);
         // Just update local state. Backend updates DB after successful use.
         setSelectedModelCallName(newModelFromUI);
         // Clear current call stats when model is manually changed? Optional.
         // resetCurrentCallStats();
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
            modelUsed: stats.modelUsed || prev.modelUsed // Update if provided
        }));

        // If backend used a *different* valid model than UI selection (e.g. user pref override request),
        // update the UI selection to match what was actually used and saved by backend.
         if (stats.modelUsed && stats.modelUsed !== selectedModelCallName && availableModels.find(m => m.callName === stats.modelUsed)) {
             console.log(`[useModels] Model used in API call (${stats.modelUsed}) differs from local selection (${selectedModelCallName}). Updating UI selection.`);
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
        // Expose manual refresh if needed by UI
        updateGeminiConfig: () => loadAndSetModelsConfiguration(true),
    };
}