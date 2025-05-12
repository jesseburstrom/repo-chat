// src/hooks/useSystemPrompt.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSystemPrompt as apiLoadSystemPrompt, saveSystemPrompt as apiSaveSystemPrompt } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useSystemPrompt() {
    const { session, isLoading: authIsLoading } = useAuth();

    const [systemPrompt, setSystemPrompt] = useState<string>('');
    const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState<boolean>(true); // Added loading state
    const [isSystemPromptSaving, setIsSystemPromptSaving] = useState<boolean>(false);
    const [systemPromptMessage, setSystemPromptMessage] = useState<string | null>(null);
    const systemPromptMessageTimer = useRef<number | null>(null);

    const fetchPrompt = useCallback(async () => {
        if (!session || authIsLoading) {
             console.log('[useSystemPrompt] Skipping fetchPrompt: Waiting for auth.');
             setSystemPrompt('');
             setIsLoadingPrompt(!authIsLoading); // Stop loading if auth is done but no session
             return;
        }

        console.log('[useSystemPrompt] Fetching system prompt (DB)...');
        setIsLoadingPrompt(true);
        const result = await apiLoadSystemPrompt(); // Requires auth now
        if (result.success) {
            setSystemPrompt(result.systemPrompt || ''); // Use fetched prompt or empty string
        } else {
            setSystemPrompt(''); // Clear on error
            console.error("Failed to load system prompt:", result.error);
            // Optionally set a message: setSystemPromptMessage(`Error loading prompt: ${result.error}`);
        }
        setIsLoadingPrompt(false);
    }, [session, authIsLoading]);

    useEffect(() => {
        fetchPrompt();
    }, [fetchPrompt]);

    const handleSaveSystemPrompt = useCallback(async () => {
        if (!session || authIsLoading) { // Guard against saving without auth
             setSystemPromptMessage("Authentication required.");
             // Set timer...
             return;
        }

        setIsSystemPromptSaving(true);
        setSystemPromptMessage(null);
        if (systemPromptMessageTimer.current !== null) clearTimeout(systemPromptMessageTimer.current);

        console.log('[useSystemPrompt] Saving system prompt (DB)...');
        const result = await apiSaveSystemPrompt(systemPrompt); // Requires auth now
        if (result.success) {
            setSystemPromptMessage(result.message || 'System prompt saved successfully!');
        } else {
            setSystemPromptMessage(`Error saving system prompt: ${result.error || 'Unknown error'}`);
        }
        setIsSystemPromptSaving(false);
        systemPromptMessageTimer.current = window.setTimeout(() => setSystemPromptMessage(null), 3000);
    }, [session, authIsLoading, systemPrompt]); // Include systemPrompt dependency

    useEffect(() => { /* Timer cleanup */ return () => { /* ... */ }; }, []);

    return {
        systemPrompt,
        setSystemPrompt,
        showSystemPromptInput,
        setShowSystemPromptInput,
        isLoadingPrompt, // Expose loading state
        isSystemPromptSaving,
        systemPromptMessage,
        handleSaveSystemPrompt,
    };
}