// backend/src/routes/geminiRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content, FinishReason, SafetyRating, StartChatParams } from "@google/generative-ai";
import { GEMINI_MODELS, calculateCost } from '../geminiModels';
import {
    SYSTEM_PROMPT_FULL_PATH,
    saveLastSelectedModel as persistSelectedModel,
    getCurrentModelCallName,
    GEMINI_CONFIG_PATH,
    supabaseAdminClient // Import admin client
} from '../config/appConfig';
import { AuthenticatedRequest } from '../middleware/authMiddleware'; // Import AuthenticatedRequest
import { getUserGeminiApiKey } from '../services/userApiKeyService'; // Import service

const router = express.Router();

// Remove or comment out global GEMINI_API_KEY and genAI instance
// const geminiApiKey_global: string | undefined = process.env.GEMINI_API_KEY;
// if (!geminiApiKey_global) {
//   console.warn("WARNING: Global GEMINI_API_KEY not found. User-specific keys are required for Gemini calls.");
// }
// const genAI_global = geminiApiKey_global ? new GoogleGenerativeAI(geminiApiKey_global) : null;

const generationConfig: GenerationConfig = { /* ... your config ... */ };

interface SaveSystemPromptBody {
    systemPrompt: string;
}

interface CallGeminiRequestBody {
    history: Content[];
    newMessage: string;
    systemPrompt?: string;
    modelCallName?: string;
}

interface GeminiApiResponse {
    success: boolean;
    text?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    modelUsed?: string;
}

router.get('/gemini-config', (req: Request, res: Response) => {
    const clientSafeModels = GEMINI_MODELS.map(m => ({
        displayName: m.displayName,
        callName: m.callName,
        capabilities: m.capabilities,
        notes: m.notes,
    }));
    res.status(200).json({
        success: true,
        models: clientSafeModels,
        currentModelCallName: getCurrentModelCallName(),
    });
});

router.post('/call-gemini', async (
    req: AuthenticatedRequest, // Use AuthenticatedRequest
    res: Response<GeminiApiResponse>,
    next: NextFunction
): Promise<void> => {
    const { history, newMessage, systemPrompt, modelCallName: requestedModelCallName } = req.body as CallGeminiRequestBody;
    const userId = req.user?.id;

    if (!userId) {
        res.status(403).json({ success: false, error: 'User not authenticated.' });
        return;
    }
    if (!supabaseAdminClient) {
         res.status(500).json({ success: false, error: 'Server configuration error (admin client for API key).' });
         return;
    }

    if (!newMessage) {
        res.status(400).json({ success: false, error: 'newMessage is required.' });
        return;
    }
    if (!Array.isArray(history)) {
        res.status(400).json({ success: false, error: 'history must be an array.' });
        return;
    }

    let userGeminiApiKey: string | null = null;
    try {
        userGeminiApiKey = await getUserGeminiApiKey(userId, supabaseAdminClient);
    } catch (e) {
        console.error("Error fetching user's Gemini API key during /call-gemini:", e);
        res.status(500).json({ success: false, error: "Failed to retrieve API key." });
        return;
    }

    if (!userGeminiApiKey) {
        // Fallback to global key IF it's configured and you want this behavior
        // if (geminiApiKey_global) {
        //     userGeminiApiKey = geminiApiKey_global;
        //     console.warn(`User ${userId} does not have a Gemini API key. Using global fallback.`);
        // } else {
        res.status(402).json({ // 402 Payment Required is a common status for missing API keys/quotas
            success: false,
            error: 'Gemini API key not configured for this user. Please set your API key in settings.'
        });
        return;
        // }
    }

    // Initialize GoogleGenerativeAI with the user's key for this specific call
    const genAI_userSpecific = new GoogleGenerativeAI(userGeminiApiKey);

    const modelToUse = requestedModelCallName && GEMINI_MODELS.some(m => m.callName === requestedModelCallName)
        ? requestedModelCallName
        : getCurrentModelCallName();

    console.log(`Received Gemini request for user ${userId}. Model: ${modelToUse}, History length: ${history.length}`);
    let effectiveSystemInstruction = systemPrompt;

    if (!effectiveSystemInstruction && fs.existsSync(SYSTEM_PROMPT_FULL_PATH)) {
        try {
            effectiveSystemInstruction = await fs.promises.readFile(SYSTEM_PROMPT_FULL_PATH, 'utf-8');
            console.log("Loaded system instruction from file for Gemini API call.");
        } catch (err) {
            console.warn("Could not load system_prompt.txt for Gemini API call, proceeding without it.", err);
        }
    }
    if (effectiveSystemInstruction) console.log("Effective System Instruction for Gemini API. Length:", effectiveSystemInstruction.length);
    console.log("New message:", newMessage.substring(0, 50) + "...");

    try {
        const modelOptions: {
            model: string;
            generationConfig: GenerationConfig;
            systemInstruction?: string | Content;
        } = {
            model: modelToUse,
            generationConfig,
        };
        if (effectiveSystemInstruction && effectiveSystemInstruction.trim().length > 0) {
            modelOptions.systemInstruction = effectiveSystemInstruction;
        }

        // Use the user-specific genAI instance
        const dynamicModel = genAI_userSpecific.getGenerativeModel(modelOptions);
        const startChatParams: StartChatParams = { history };
        const chatSession = dynamicModel.startChat(startChatParams);
        const result = await chatSession.sendMessage(newMessage);
        const response = result.response;

        if (response.promptFeedback?.blockReason) {
            const reason = response.promptFeedback.blockReason;
            const safetyRatings = response.promptFeedback.safetyRatings; // Get the ratings for logging if needed

            // Log the detailed safety ratings if available and a block occurred
            if (safetyRatings && safetyRatings.length > 0) {
                console.warn(`Gemini API call blocked for reason: ${reason}. Detailed safety ratings:`, JSON.stringify(safetyRatings));
            } else {
                console.warn(`Gemini API call blocked for reason: ${reason}. No detailed safety ratings provided.`);
            }

            // Check if the block reason implies an API key issue or generic failure
            // The `reason === 'OTHER'` check combined with an empty response is a heuristic
            if (reason === 'OTHER' && response.text() === undefined && result.response.candidates === undefined) {
                 console.error(`Gemini API call might have failed due to API key issue for user ${userId}. Block reason: ${reason}`);
                 res.status(403).json({ success: false, error: `API call failed. Potentially an issue with the configured API key: ${reason}` });
                 return;
            }

            // For all other block reasons, or if the above heuristic doesn't match:
            res.status(400).json({ success: false, error: `Prompt blocked by safety filter: ${reason}` });
            return;
        }

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
            res.status(500).json({ success: false, error: 'Gemini API returned no response candidates.' });
            return;
        }
        const firstCandidate = candidates[0];
        if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
            res.status(400).json({ success: false, error: `Response stopped due to ${firstCandidate.finishReason}` });
            return;
        }
        if (!firstCandidate.content?.parts || firstCandidate.content.parts.length === 0 || !firstCandidate.content.parts.some(p => p.text)) {
            res.status(500).json({ success: false, error: 'Gemini API returned no text content.' });
            return;
        }
        const responseText = response.text();
        let inputTokens = 0, outputTokens = 0;
        if (response.usageMetadata) {
            inputTokens = response.usageMetadata.promptTokenCount || 0;
            outputTokens = response.usageMetadata.candidatesTokenCount || 0;
        } else {
            try {
                const promptTokenCountResult = await dynamicModel.countTokens(newMessage);
                inputTokens = promptTokenCountResult.totalTokens;
                const responseTokenCountResult = await dynamicModel.countTokens(responseText);
                outputTokens = responseTokenCountResult.totalTokens;
                console.warn(`Used manual token counting for ${modelToUse}. Input: ${inputTokens}, Output: ${outputTokens}.`);
            } catch (countError: any) {
                 console.error("Error counting tokens manually:", countError);
                 // If counting fails, it might be an API key issue (e.g., invalid key used for counting)
                 // This error often presents as "API key not valid" or similar.
                 if (countError.message && (countError.message.includes("API_KEY") || countError.message.includes("PERMISSION_DENIED"))){
                     res.status(403).json({ success: false, error: `Token counting failed. Please check if your Gemini API key is valid and has billing enabled: ${countError.message}` });
                     return;
                 }
            }
        }
        const { inputCost, outputCost, totalCost } = calculateCost(modelToUse, inputTokens, outputTokens);

        if (modelToUse !== getCurrentModelCallName() || (requestedModelCallName && requestedModelCallName === modelToUse && !fs.existsSync(GEMINI_CONFIG_PATH)) ) {
            persistSelectedModel(modelToUse);
        }

        res.status(200).json({
            success: true, text: responseText, inputTokens, outputTokens,
            totalTokens: inputTokens + outputTokens, inputCost, outputCost, totalCost, modelUsed: modelToUse,
        });

    } catch (error: any) {
        console.error(`Error calling Gemini API on server for user ${userId} with model ${modelToUse}:`, error);
        // Specific check for API key related errors from Google's SDK
        if (error.message && (error.message.includes("API_KEY_INVALID") || error.message.includes("PERMISSION_DENIED") || error.message.includes("API key not valid"))) {
            res.status(403).json({ success: false, error: `Gemini API Key Error: ${error.message}. Please check your key and ensure billing is enabled for your Google Cloud project.` });
        } else {
            next(error);
        }
    }
});

router.get('/load-system-prompt', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // ... (this route remains unchanged)
     console.log(`Request received for /load-system-prompt`);
     try {
         if (fs.existsSync(SYSTEM_PROMPT_FULL_PATH)) {
             const promptContent = await fs.promises.readFile(SYSTEM_PROMPT_FULL_PATH, 'utf-8');
             res.status(200).json({ success: true, systemPrompt: promptContent });
         } else {
             res.status(200).json({ success: true, systemPrompt: '' }); // File not found, return empty
         }
     } catch (error: any) {
         console.error("Error loading system prompt from file:", error);
         res.status(500).json({ success: false, error: "Could not load system prompt from file." });
     }
});

router.post('/save-system-prompt', async (
    req: Request<{}, {}, SaveSystemPromptBody>,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // ... (this route remains unchanged)
     const { systemPrompt } = req.body;
     console.log(`Request received for /save-system-prompt (file). Length: ${systemPrompt?.length}`);
     if (typeof systemPrompt !== 'string') {
         res.status(400).json({ success: false, error: 'systemPrompt (string) is required in the body.' });
         return;
     }
     try {
         await fs.promises.writeFile(SYSTEM_PROMPT_FULL_PATH, systemPrompt, 'utf-8');
         res.status(200).json({ success: true, message: 'System prompt saved to file.' });
     } catch (error: any) {
         console.error("Error saving system prompt to file:", error);
         res.status(500).json({ success: false, error: 'Could not save system prompt to file.' });
     }
});

export default router;