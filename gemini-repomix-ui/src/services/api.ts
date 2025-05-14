// src/services/api.ts

import type { ChatMessage } from '../types';
import type { ClientGeminiModelInfo } from '../components/ModelSettings'; // Adjust path if needed
import type { RepoInfo } from '../components/RepoSelector'; // Adjust path if needed
import { supabase } from './supabaseClient'; // Import supabase client

const API_PREFIX = import.meta.env.DEV ? '' : '/repochat'; // Your existing prefix logic

// --- Interfaces for API responses (mirroring backend where possible) ---
interface BaseResponse {
    success: boolean;
    error?: string;
}

// --- Load System Prompt ---
interface LoadSystemPromptResponse extends BaseResponse {
    systemPrompt?: string;
}

// --- Save System Prompt ---
interface SaveSystemPromptResponse extends BaseResponse {
    message?: string;
}

// --- Gemini Config ---
interface GeminiConfigResponse extends BaseResponse {
    models?: ClientGeminiModelInfo[];
    currentModelCallName?: string;
}

// --- List Generated Files ---
// The 'data' field for listGeneratedFiles will be an array of RepoInfo
// RepoInfo is typically { filename: string; repoIdentifier: string; }
// This type is imported from '../RepoSelector'
export interface ListGeneratedFilesResponse extends BaseResponse {
    data?: RepoInfo[];
}

// --- Get File Content ---
interface GetFileContentResponse extends BaseResponse {
    content?: string;
}

// --- Run Repomix ---
// This is the structure of the 'data' field within RunRepomixResponse if successful
interface RunRepomixSuccessData {
    newFile: { filename: string; repoIdentifier: string };
    message: string;
}

// This is the overall response structure from /api/run-repomix
// This interface needs to be EXPORTED to be used in other files like RepomixContext.tsx
export interface RunRepomixResponse extends BaseResponse {
    data?: RunRepomixSuccessData; // The 'data' field is optional and contains the actual payload
    stderr?: string;
    stdout?: string;
}


// --- Call Gemini ---
// Exporting as App.tsx might use it, and it's good practice for shared types
export interface GeminiApiResponse extends BaseResponse {
    text?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}

// --- New interfaces for API Key Management ---
export interface GeminiKeyStatusResponse extends BaseResponse {
    hasKey?: boolean;
}

export interface SetGeminiKeyResponse extends BaseResponse {
    message?: string;
}

// --- Centralized Auth Error Handler (for critical 401/403) ---
async function handleCriticalAuthError(errorMessage?: string) {
    console.warn(`[api.ts] Critical Authentication Error: ${errorMessage || 'Forcing sign out.'}`);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
        console.error('[api.ts] Error during forced signOut after API auth failure:', signOutError);
    }
    // onAuthStateChange in AuthContext should handle redirecting to login.
    // No need to redirect here, just ensure state is cleared.
}

// --- Common API Request Function ---
async function makeApiRequest<T extends BaseResponse>(url: string, options: RequestInit = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json', // Default
        ...(options.headers as Record<string, string> || {}), // Spread existing headers
    };

    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    } else if (!url.includes('/user-config/')) { // Allow user-config routes to proceed for initial key setup if unauthed, backend will still check
        console.warn(`[api.ts] No access token found in session for request to: ${url}. Request will proceed without Authorization header.`);
    }


    let response: Response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch (networkError: any) {
        console.error(`[api.ts] Network error during API request to ${url}:`, networkError);
        return { success: false, error: networkError.message || "Network connection failed." } as T;
    }

    if (response.status === 401 || response.status === 403) {
        const errorText = await response.text().catch(() => `Access Denied (Status: ${response.status})`);
        let errorJsonMessage = `Access Denied (Status: ${response.status})`;
        try {
            const parsedError = JSON.parse(errorText);
            errorJsonMessage = parsedError.error || errorJsonMessage;
        } catch (e) {
            if (errorText.trim()) errorJsonMessage = errorText.trim();
        }
        // Avoid calling signOut for specific 403s that might be Gemini key related, not session related
        if (!errorJsonMessage.toLowerCase().includes("gemini api key")) {
            await handleCriticalAuthError(errorJsonMessage);
        }
        return { success: false, error: errorJsonMessage } as T;
    }

    if (response.status === 402) { // Payment Required - typically API key or quota
        const errorText = await response.text().catch(() => `Operation requires payment/quota (Status: ${response.status})`);
        let errorJsonMessage = `Operation requires a valid API key or sufficient quota (Status: ${response.status})`;
        try {
            const parsedError = JSON.parse(errorText);
            errorJsonMessage = parsedError.error || errorJsonMessage;
        } catch (e) {
            if (errorText.trim()) errorJsonMessage = errorText.trim();
        }
        return { success: false, error: errorJsonMessage } as T;
    }

    if (!response.ok) { // Other non-2xx errors
        const errorText = await response.text().catch(() => `API request failed (Status: ${response.status})`);
        let errorJsonMessage = `API request failed (Status: ${response.status})`;
        try {
            const parsedError = JSON.parse(errorText);
            errorJsonMessage = parsedError.error || errorJsonMessage;
        } catch (e) {
            if (errorText.trim()) errorJsonMessage = errorText.trim();
        }
        return { success: false, error: errorJsonMessage } as T;
    }

    // Handle successful responses
    const responseText = await response.text();
    if (!responseText && response.status === 204) { // HTTP 204 No Content is a success
        return { success: true } as T;
    }
    if (!responseText && response.ok) { // Other empty successful responses (e.g. 200 OK with empty body)
        return { success: true } as T;
    }

    try {
        return JSON.parse(responseText) as T;
    } catch (jsonParseError) {
        console.error(`[api.ts] Failed to parse successful response as JSON for ${url}:`, responseText, jsonParseError);
        return { success: false, error: "Failed to parse server response." } as T;
    }
}


// --- API Service Functions ---

export async function loadSystemPrompt(): Promise<LoadSystemPromptResponse> {
    return makeApiRequest<LoadSystemPromptResponse>(`${API_PREFIX}/api/load-system-prompt`);
}

export async function saveSystemPrompt(systemPrompt: string): Promise<SaveSystemPromptResponse> {
    return makeApiRequest<SaveSystemPromptResponse>(`${API_PREFIX}/api/save-system-prompt`, {
        method: 'POST',
        body: JSON.stringify({ systemPrompt }),
    });
}

export async function fetchGeminiConfig(): Promise<GeminiConfigResponse> {
    return makeApiRequest<GeminiConfigResponse>(`${API_PREFIX}/api/gemini-config`);
}

// The function now correctly uses ListGeneratedFilesResponse which expects `data?: RepoInfo[]`
export async function listGeneratedFiles(): Promise<ListGeneratedFilesResponse> {
    return makeApiRequest<ListGeneratedFilesResponse>(`${API_PREFIX}/api/list-generated-files`);
}

export async function getFileContent(filename: string): Promise<GetFileContentResponse> {
    return makeApiRequest<GetFileContentResponse>(`${API_PREFIX}/api/get-file-content/${encodeURIComponent(filename)}`);
}

interface RunRepomixParams {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}
// The function itself correctly uses the (now exported) RunRepomixResponse type
export async function runRepomix(params: RunRepomixParams): Promise<RunRepomixResponse> {
    return makeApiRequest<RunRepomixResponse>(`${API_PREFIX}/api/run-repomix`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

interface CallGeminiParams {
    history: ChatMessage[];
    newMessage: string;
    // systemPrompt is handled by backend now and fetched from user's DB settings
    modelCallName?: string; // Client can suggest a model for this one call
}
export async function callGemini(params: CallGeminiParams): Promise<GeminiApiResponse> {
    return makeApiRequest<GeminiApiResponse>(`${API_PREFIX}/api/call-gemini`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

// --- New API Service Functions for User Gemini Key ---
export async function getGeminiApiKeyStatus(): Promise<GeminiKeyStatusResponse> {
    return makeApiRequest<GeminiKeyStatusResponse>(`${API_PREFIX}/api/user-config/gemini-key-status`);
}

export async function setGeminiApiKey(apiKey: string): Promise<SetGeminiKeyResponse> {
    return makeApiRequest<SetGeminiKeyResponse>(`${API_PREFIX}/api/user-config/gemini-key`, {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
    });
}

export interface DeleteFileApiResponse extends BaseResponse { // BaseResponse has success and error?
    message?: string;
}

export async function deleteGeneratedFile(filename: string): Promise<DeleteFileApiResponse> {
    return makeApiRequest<DeleteFileApiResponse>(`${API_PREFIX}/api/delete-file/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
    });
}