// gemini-repomix-ui/src/hooks/useApiKeyStatus.ts
import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface UseApiKeyStatusProps {
    updateGeminiConfig: () => void; // From useModels
}

export interface UseApiKeyStatusReturn {
    userHasGeminiKey: boolean | null;
    showApiKeyModal: boolean;
    apiKeyStatusLoading: boolean;
    apiKeyError: string | null;
    openApiKeyModal: () => void;
    closeApiKeyModal: () => void;
    handleApiKeySubmittedInModal: () => void;
}

export function useApiKeyStatus({ updateGeminiConfig }: UseApiKeyStatusProps): UseApiKeyStatusReturn {
    const { session, user, isLoading: authIsLoading } = useAuth();
    const [userHasGeminiKey, setUserHasGeminiKey] = useState<boolean | null>(null);
    const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
    const [apiKeyStatusLoading, setApiKeyStatusLoading] = useState<boolean>(true);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);

    const checkApiKeyStatus = useCallback(async () => {
        if (session && user && !authIsLoading) {
            setApiKeyStatusLoading(true);
            setApiKeyError(null);
            const statusResult = await api.getGeminiApiKeyStatus();
            if (statusResult.success) {
                setUserHasGeminiKey(statusResult.hasKey ?? false);
                if (!statusResult.hasKey) {
                    setShowApiKeyModal(true);
                } else {
                    setShowApiKeyModal(false);
                }
            } else {
                console.error("[useApiKeyStatus] Failed to get API key status:", statusResult.error);
                setApiKeyError("Could not verify Gemini API key status: " + statusResult.error);
                setUserHasGeminiKey(false);
            }
            setApiKeyStatusLoading(false);
        } else if (!session && !authIsLoading) {
            setUserHasGeminiKey(null);
            setShowApiKeyModal(false);
            setApiKeyStatusLoading(false);
            setApiKeyError(null);
        }
    }, [session, user, authIsLoading]);

    useEffect(() => {
        checkApiKeyStatus();
    }, [checkApiKeyStatus]);

    const handleApiKeySubmittedInModal = useCallback(() => {
        if (session && user && !authIsLoading) {
            setApiKeyStatusLoading(true);
            api.getGeminiApiKeyStatus().then(statusResult => {
                if (statusResult.success) {
                    setUserHasGeminiKey(statusResult.hasKey ?? false);
                    if (statusResult.hasKey) {
                        setShowApiKeyModal(false);
                        setApiKeyError(null);
                        updateGeminiConfig();
                    } else {
                         setApiKeyError("API key submitted, but status still shows no key.");
                    }
                } else {
                    console.error("[useApiKeyStatus] Error re-checking API key status after submission:", statusResult.error);
                    setApiKeyError("Error re-checking API key status: " + statusResult.error);
                }
                setApiKeyStatusLoading(false);
            }).catch(err => {
                console.error("[useApiKeyStatus] Exception re-checking API key status after submission:", err);
                setApiKeyError("Exception re-checking API key status.");
                setApiKeyStatusLoading(false);
            });
        }
    }, [session, user, authIsLoading, updateGeminiConfig]);

    const openApiKeyModal = useCallback(() => setShowApiKeyModal(true), []);
    const closeApiKeyModal = useCallback(() => setShowApiKeyModal(false), []);

    return {
        userHasGeminiKey,
        showApiKeyModal,
        apiKeyStatusLoading,
        apiKeyError,
        openApiKeyModal,
        closeApiKeyModal,
        handleApiKeySubmittedInModal,
    };
}