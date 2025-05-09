// src/services/api.ts

import type { ChatMessage } from '../App'; // Assuming ChatMessage is in App.tsx, adjust if moved
import type { ClientGeminiModelInfo } from '../ModelSettings'; // Adjust path if needed
import type { RepoInfo } from '../RepoSelector'; // Adjust path if needed
import { supabase } from '../supabaseClient'; // Import supabase client

const API_PREFIX = import.meta.env.DEV ? '' : '/repochat'; // Your existing prefix logic

// --- Interfaces for API responses (mirroring backend where possible) ---
interface BaseResponse {
    success: boolean;
    error?: string;
}

interface LoadSystemPromptResponse extends BaseResponse {
    systemPrompt?: string;
}

interface SaveSystemPromptResponse extends BaseResponse {
    message?: string;
}

interface GeminiConfigResponse extends BaseResponse {
    models?: ClientGeminiModelInfo[];
    currentModelCallName?: string;
}

interface ListGeneratedFilesResponse extends BaseResponse {
    data?: RepoInfo[];
}

interface GetFileContentResponse extends BaseResponse {
    content?: string;
}

interface RunRepomixResponse extends BaseResponse {
    message?: string;
    outputFilename?: string;
    stderr?: string; // For debugging
    stdout?: string; // For debugging
}

export interface GeminiApiResponse extends BaseResponse { // Exporting as App.tsx uses it
    text?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}

// --- Centralized Auth Error Handler ---
async function handleCriticalAuthError(errorMessage?: string) {
    console.warn(`[api.ts] Critical Authentication Error: ${errorMessage || 'Forcing sign out.'}`);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
        console.error('[api.ts] Error during forced signOut after API auth failure:', signOutError);
        // Consider more drastic measures if signOut fails, e.g., alert user, clear local storage (carefully)
        // For now, the primary mechanism is relying on onAuthStateChange after signOut.
    }
    // onAuthStateChange in AuthContext should handle redirecting to login.
}

// --- Common API Request Function ---
async function makeApiRequest<T extends BaseResponse>(url: string, options: RequestInit = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json', // Default
        // Spread options.headers if it's also a Record<string, string> or compatible
        ...(options.headers as Record<string, string> || {}),
    };
    
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
        // Potentially log if a protected endpoint is called without a token,
        // but let the backend return 401/403 to confirm.
        console.warn(`[api.ts] No access token found in session for request to: ${url}. Request will proceed without Authorization header.`);
    }

    let response: Response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch (networkError: any) {
        console.error(`[api.ts] Network error during API request to ${url}:`, networkError);
        // Return a BaseResponse compatible error structure
        return { success: false, error: networkError.message || "Network connection failed." } as T;
    }

    if (response.status === 401 || response.status === 403) {
        const errorText = await response.text(); // Get raw text first for better debugging
        let errorJson: BaseResponse = { success: false, error: `Access Denied (Status: ${response.status})` };
        try {
            errorJson = JSON.parse(errorText); // Try to parse as JSON
        } catch (e) {
            console.warn(`[api.ts] Could not parse ${response.status} error response as JSON:`, errorText);
            errorJson.error = errorText || errorJson.error; // Use raw text if not JSON
        }
        
        await handleCriticalAuthError(errorJson.error || `Server returned ${response.status}`);
        // Even though we've initiated a sign-out, return an error object
        // so the calling hook/component knows the specific request failed.
        return { success: false, error: errorJson.error || `Access Denied (Status: ${response.status})` } as T;
    }

    if (!response.ok) {
        const errorText = await response.text();
        let errorJson: BaseResponse = { success: false, error: `API request failed (Status: ${response.status})` };
         try {
            errorJson = JSON.parse(errorText);
        } catch (e) {
             console.warn(`[api.ts] Could not parse non-2xx error response as JSON:`, errorText);
            errorJson.error = errorText || errorJson.error;
        }
        return { success: false, error: errorJson.error || `API request failed (Status: ${response.status})` } as T;
    }

    // If response.ok, try to parse as JSON.
    // Handle cases where the response might be empty or not JSON.
    const responseText = await response.text();
    if (!responseText) { // Handle empty successful response (e.g., HTTP 204 No Content)
        return { success: true } as T; // Or adjust based on expected non-JSON success
    }
    try {
        return JSON.parse(responseText) as T;
    } catch (jsonParseError) {
        console.error(`[api.ts] Failed to parse successful response as JSON for ${url}:`, responseText, jsonParseError);
        return { success: false, error: "Failed to parse server response." } as T;
    }
}


// --- Refactored API Service Functions ---

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
export async function runRepomix(params: RunRepomixParams): Promise<RunRepomixResponse> {
    return makeApiRequest<RunRepomixResponse>(`${API_PREFIX}/api/run-repomix`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

interface CallGeminiParams {
    history: ChatMessage[];
    newMessage: string;
    systemPrompt?: string;
    modelCallName?: string;
}
export async function callGemini(params: CallGeminiParams): Promise<GeminiApiResponse> {
    return makeApiRequest<GeminiApiResponse>(`${API_PREFIX}/api/call-gemini`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}