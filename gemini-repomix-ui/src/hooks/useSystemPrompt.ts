// src/hooks/useSystemPrompt.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSystemPrompt as apiLoadSystemPrompt, saveSystemPrompt as apiSaveSystemPrompt } from '../services/api';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export function useSystemPrompt() {
    const { session, isLoading: authIsLoading } = useAuth(); // Get auth state

    const [systemPrompt, setSystemPrompt] = useState<string>('');
    const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
    const [isSystemPromptSaving, setIsSystemPromptSaving] = useState<boolean>(false);
    const [systemPromptMessage, setSystemPromptMessage] = useState<string | null>(null);
    const systemPromptMessageTimer = useRef<number | null>(null);

    const fetchPrompt = useCallback(async () => {
        // Only fetch if authenticated and auth process is complete
        if (!session || authIsLoading) {
            // console.log('[useSystemPrompt] Skipping fetchPrompt: Not authenticated or auth is loading.');
            setSystemPrompt(''); // Clear prompt if not authenticated
            // Optionally, set an error or message indicating auth is required
            return;
        }

        // console.log('[useSystemPrompt] Fetching system prompt...');
        const result = await apiLoadSystemPrompt();
        if (result.success && typeof result.systemPrompt === 'string') {
            setSystemPrompt(result.systemPrompt);
        } else {
            setSystemPrompt('');
            if (result.error) {
                console.error("Failed to load system prompt:", result.error);
                // setSystemPromptMessage(`Error loading prompt: ${result.error}`); // Optional: show error to user
            }
        }
    }, [session, authIsLoading]);

    useEffect(() => {
        fetchPrompt();
    }, [fetchPrompt]); // Dependency on the memoized callback

    const handleSaveSystemPrompt = useCallback(async () => {
        if (!session || authIsLoading) {
            // console.log('[useSystemPrompt] Skipping saveSystemPrompt: Not authenticated or auth is loading.');
            setSystemPromptMessage("Authentication required to save system prompt.");
             if (systemPromptMessageTimer.current !== null) clearTimeout(systemPromptMessageTimer.current);
            systemPromptMessageTimer.current = window.setTimeout(() => setSystemPromptMessage(null), 3000);
            return;
        }

        setIsSystemPromptSaving(true);
        setSystemPromptMessage(null);
        if (systemPromptMessageTimer.current !== null) {
            clearTimeout(systemPromptMessageTimer.current);
        }

        // console.log('[useSystemPrompt] Saving system prompt...');
        const result = await apiSaveSystemPrompt(systemPrompt); // systemPrompt state is used
        if (result.success) {
            setSystemPromptMessage(result.message || 'System prompt (file) saved successfully!');
        } else {
            setSystemPromptMessage(`Error saving system prompt (file): ${result.error || 'Unknown error'}`);
        }
        setIsSystemPromptSaving(false);
        systemPromptMessageTimer.current = window.setTimeout(() => setSystemPromptMessage(null), 3000);
    }, [session, authIsLoading, systemPrompt]); // Add systemPrompt to dependencies

    useEffect(() => {
        // Cleanup timer on unmount
        return () => {
            if (systemPromptMessageTimer.current !== null) {
                clearTimeout(systemPromptMessageTimer.current);
            }
        };
    }, []);

    return {
        systemPrompt,
        setSystemPrompt, // Allow App to update the local systemPrompt state before saving
        showSystemPromptInput,
        setShowSystemPromptInput,
        isSystemPromptSaving,
        systemPromptMessage,
        handleSaveSystemPrompt,
    };
}