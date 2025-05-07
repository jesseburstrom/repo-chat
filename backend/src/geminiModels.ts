// backend/src/geminiModels.ts
export interface PriceTier {
    upToTokens: number; // In tokens (e.g., 128000 for <=128k). Use Infinity for the last tier.
    perMillionTokens: number;
}

export interface ModelPricing {
    input: PriceTier[];
    output: PriceTier[];
    // For simplicity, we'll assume 'thinking' rate for models with differentiated output costs.
}

export interface GeminiModelInfo {
    displayName: string;
    callName: string;
    capabilities: string;
    pricing: ModelPricing;
    notes?: string; // For special pricing like Flash 2.5 thinking output
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
    {
        displayName: "Gemini 2.5 Pro Preview (Paid)",
        callName: "gemini-2.5-pro-preview-05-06", // Assuming this is the intended paid version
        capabilities: "Advanced reasoning, complex coding, multimodal understanding",
        pricing: {
            input: [
                { upToTokens: 200000, perMillionTokens: 1.25 },
                { upToTokens: Infinity, perMillionTokens: 2.50 },
            ],
            output: [
                { upToTokens: 200000, perMillionTokens: 10.00 },
                { upToTokens: Infinity, perMillionTokens: 15.00 },
            ],
        },
    },
    {
        displayName: "Gemini 2.5 Pro Preview (Free)",
        callName: "gemini-2.5-pro-exp-03-25",
        capabilities: "Advanced reasoning, complex coding, multimodal understanding (Rate Limited)",
        pricing: { // Assuming free tier means $0 cost for calculation purposes
            input: [{ upToTokens: Infinity, perMillionTokens: 0 }],
            output: [{ upToTokens: Infinity, perMillionTokens: 0 }],
        },
        notes: "Free tier with rate limits. Costs are $0 for estimation."
    },
    {
        displayName: "Gemini 2.5 Flash Preview",
        callName: "gemini-2.5-flash-preview-04-17",
        capabilities: "Adaptive thinking, cost efficiency",
        pricing: {
            input: [{ upToTokens: Infinity, perMillionTokens: 0.15 }], // Text/Image/Video rate
            // Output: $0.60 (non-thinking), $3.50 (thinking). We'll use $3.50 to overestimate.
            output: [{ upToTokens: Infinity, perMillionTokens: 3.50 }],
        },
        notes: "Audio input $1.00/1M. Output cost estimated at 'thinking' rate ($3.50/1M)."
    },
    {
        displayName: "Gemini 2.0 Flash",
        callName: "gemini-2.0-flash",
        capabilities: "Multimodal generation, real-time streaming",
        pricing: {
            input: [{ upToTokens: Infinity, perMillionTokens: 0.10 }], // Text/Image/Video rate
            output: [{ upToTokens: Infinity, perMillionTokens: 0.40 }],
        },
        notes: "Audio input $0.70/1M."
    },
    {
        displayName: "Gemini 2.0 Flash-Lite",
        callName: "gemini-2.0-flash-lite",
        capabilities: "Cost efficiency, low latency",
        pricing: {
            input: [{ upToTokens: Infinity, perMillionTokens: 0.075 }],
            output: [{ upToTokens: Infinity, perMillionTokens: 0.30 }],
        },
    },
    {
        displayName: "Gemini 1.5 Pro",
        callName: "gemini-1.5-pro", // Make sure this is the exact API call name
        capabilities: "Complex reasoning, large context window",
        pricing: {
            input: [
                { upToTokens: 128000, perMillionTokens: 1.25 },
                { upToTokens: Infinity, perMillionTokens: 2.50 },
            ],
            output: [
                { upToTokens: 128000, perMillionTokens: 5.00 },
                { upToTokens: Infinity, perMillionTokens: 10.00 },
            ],
        },
    },
    {
        displayName: "Gemini 1.5 Flash",
        callName: "gemini-1.5-flash",
        capabilities: "Fast, versatile performance",
        pricing: {
            input: [
                { upToTokens: 128000, perMillionTokens: 0.075 },
                { upToTokens: Infinity, perMillionTokens: 0.15 },
            ],
            output: [
                { upToTokens: 128000, perMillionTokens: 0.30 },
                { upToTokens: Infinity, perMillionTokens: 0.60 },
            ],
        },
    },
    {
        displayName: "Gemini 1.5 Flash-8B",
        callName: "gemini-1.5-flash-8b",
        capabilities: "High-volume, lower-intelligence tasks",
        pricing: {
            input: [
                { upToTokens: 128000, perMillionTokens: 0.0375 },
                { upToTokens: Infinity, perMillionTokens: 0.075 },
            ],
            output: [
                { upToTokens: 128000, perMillionTokens: 0.15 },
                { upToTokens: Infinity, perMillionTokens: 0.30 },
            ],
        },
    },
];

export const DEFAULT_MODEL_CALL_NAME = "gemini-2.5-pro-preview-05-06"; // Default paid model

function calculateTieredCost(tokens: number, tiers: PriceTier[]): number {
    if (tokens === 0) return 0;
    let cost = 0;
    let remainingTokens = tokens;
    let lastTierLimit = 0;

    for (const tier of tiers) {
        if (remainingTokens <= 0) break;

        const tokensInThisTier = Math.min(remainingTokens, tier.upToTokens - lastTierLimit);
        cost += (tokensInThisTier / 1_000_000) * tier.perMillionTokens;
        remainingTokens -= tokensInThisTier;
        lastTierLimit = tier.upToTokens;

        if (tier.upToTokens === Infinity && remainingTokens > 0) {
            // This case should not be strictly needed if tiers are correct
            // but as a fallback for the last tier (Infinity)
            cost += (remainingTokens / 1_000_000) * tier.perMillionTokens;
            remainingTokens = 0;
        }
    }
    return cost;
}

export function calculateCost(
    modelCallName: string,
    inputTokens: number,
    outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
    const modelInfo = GEMINI_MODELS.find(m => m.callName === modelCallName);
    if (!modelInfo) {
        console.warn(`Pricing info not found for model: ${modelCallName}. Returning $0 cost.`);
        return { inputCost: 0, outputCost: 0, totalCost: 0 };
    }

    const inputCost = calculateTieredCost(inputTokens, modelInfo.pricing.input);
    const outputCost = calculateTieredCost(outputTokens, modelInfo.pricing.output);

    return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
    };
}