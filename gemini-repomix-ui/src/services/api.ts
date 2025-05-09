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
    totalTokens?: number; // Added this as App.tsx calculates it
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}

// --- Helper function to get headers with Authorization token ---
async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
        'Content-Type': 'application/json', // Default Content-Type for JSON APIs
    };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}


// --- API Service Functions ---

export async function loadSystemPrompt(): Promise<LoadSystemPromptResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/load-system-prompt`, { headers });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch (e) { /* ignore parsing error */ }
            return { success: false, error: errorMsg };
        }
        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message || "Network error loading system prompt." };
    }
}

export async function saveSystemPrompt(systemPrompt: string): Promise<SaveSystemPromptResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/save-system-prompt`, {
            method: 'POST',
            headers: headers, // Content-Type is included from getAuthHeaders
            body: JSON.stringify({ systemPrompt }),
        });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {/*ignore*/}
            return { success: false, error: errorMsg };
        }
        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message || "Network error saving system prompt." };
    }
}

export async function fetchGeminiConfig(): Promise<GeminiConfigResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/gemini-config`, { headers });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {/*ignore*/}
            return { success: false, error: errorMsg };
        }
        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message || "Network error fetching Gemini config." };
    }
}

export async function listGeneratedFiles(): Promise<ListGeneratedFilesResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/list-generated-files`, { headers });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {/*ignore*/}
            return { success: false, error: errorMsg };
        }
        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message || "Network error listing generated files." };
    }
}

export async function getFileContent(filename: string): Promise<GetFileContentResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/get-file-content/${encodeURIComponent(filename)}`, { headers });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {/*ignore*/}
            return { success: false, error: errorMsg };
        }
        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message || "Network error getting file content." };
    }
}

interface RunRepomixParams {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}
export async function runRepomix(params: RunRepomixParams): Promise<RunRepomixResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/run-repomix`, {
            method: 'POST',
            headers: headers, // Content-Type is included from getAuthHeaders
            body: JSON.stringify(params),
        });
        const result: RunRepomixResponse = await response.json();
        if (!response.ok && !result.error) {
             return { ...result, success: false, error: result.error || `HTTP error ${response.status}` };
        }
        return result;
    } catch (err: any) {
        return { success: false, error: err.message || "Network error running Repomix." };
    }
}

interface CallGeminiParams {
    history: ChatMessage[];
    newMessage: string;
    systemPrompt?: string;
    modelCallName?: string;
}
export async function callGemini(params: CallGeminiParams): Promise<GeminiApiResponse> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_PREFIX}/api/call-gemini`, {
            method: 'POST',
            headers: headers, // Content-Type is included from getAuthHeaders
            body: JSON.stringify(params),
        });
        const result: GeminiApiResponse = await response.json();
        if (!response.ok && !result.error) {
             return { ...result, success: false, error: result.error || `API proxy error ${response.status}` };
        }
        return result;
    } catch (err: any) {
        return { success: false, error: err.message || "Network error calling Gemini." };
    }
}