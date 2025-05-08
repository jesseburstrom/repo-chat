// src/hooks/useSystemPrompt.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSystemPrompt as apiLoadSystemPrompt, saveSystemPrompt as apiSaveSystemPrompt } from '../services/api';

export function useSystemPrompt() {
    const [systemPrompt, setSystemPrompt] = useState<string>('');
    const [showSystemPromptInput, setShowSystemPromptInput] = useState<boolean>(false);
    const [isSystemPromptSaving, setIsSystemPromptSaving] = useState<boolean>(false);
    const [systemPromptMessage, setSystemPromptMessage] = useState<string | null>(null);
    const systemPromptMessageTimer = useRef<number | null>(null);

    useEffect(() => {
        const fetchPrompt = async () => {
            const result = await apiLoadSystemPrompt();
            if (result.success && typeof result.systemPrompt === 'string') {
                setSystemPrompt(result.systemPrompt);
            } else {
                setSystemPrompt('');
                // Optionally set an error message if result.error exists
                if (result.error) console.error("Failed to load system prompt:", result.error);
            }
        };
        fetchPrompt();
    }, []);

    const handleSaveSystemPrompt = useCallback(async () => {
        setIsSystemPromptSaving(true);
        setSystemPromptMessage(null);
        if (systemPromptMessageTimer.current) clearTimeout(systemPromptMessageTimer.current);

        const result = await apiSaveSystemPrompt(systemPrompt);
        if (result.success) {
            setSystemPromptMessage(result.message || 'System prompt (file) saved successfully!');
        } else {
            setSystemPromptMessage(`Error saving system prompt (file): ${result.error || 'Unknown error'}`);
        }
        setIsSystemPromptSaving(false);
        systemPromptMessageTimer.current = setTimeout(() => setSystemPromptMessage(null), 3000);
    }, [systemPrompt]);

    return {
        systemPrompt,
        setSystemPrompt,
        showSystemPromptInput,
        setShowSystemPromptInput,
        isSystemPromptSaving,
        systemPromptMessage,
        handleSaveSystemPrompt,
    };
}