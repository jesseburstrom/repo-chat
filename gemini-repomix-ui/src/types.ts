// gemini-repomix-ui/src/types.ts

export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

export interface ComparisonViewData {
    filePath: string;
    originalContent: string;
    suggestedContent: string;
}

// From ModelSettings.tsx
export interface ClientGeminiModelInfo {
    displayName: string;
    callName: string;
    capabilities: string;
    notes?: string;
}

export interface TokenStats {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    modelUsed?: string;
}