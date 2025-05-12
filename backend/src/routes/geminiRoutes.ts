// backend/src/routes/geminiRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content, FinishReason, SafetyRating, StartChatParams } from "@google/generative-ai";
import { GEMINI_MODELS, calculateCost, DEFAULT_MODEL_CALL_NAME } from '../geminiModels'; // Import DEFAULT
import { supabaseAdminClient } from '../config/appConfig';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
// Import NEW service functions - ADDING getUserSystemPrompt
import {
    getUserConfig, // Combined getter
    setUserLastSelectedModel, // Specific setter
    setUserSystemPrompt, // Specific setter
    getUserSystemPrompt, // <-- IMPORT THIS
    getUserGeminiApiKey // Keep specific getter for clarity in /call-gemini if preferred
} from '../services/userApiKeyService';

const router = express.Router();

// Global genAI removed as keys are user-specific
const generationConfig: GenerationConfig = { temperature: 0.7 /* your config */ };

interface SaveSystemPromptBody {
    systemPrompt: string;
}

interface CallGeminiRequestBody {
    history: Content[];
    newMessage: string;
    // systemPrompt is no longer sent from client, fetched on backend
    modelCallName?: string; // Client can still suggest a model for this *one* call
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

// --- GET /gemini-config (Requires Auth) --- FIX SIGNATURE & RETURNS
router.get('/gemini-config', async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => { // <-- ADD Promise<void>
    const userId = req.user?.id;
    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return; // <-- Add explicit return
    }

    try {
        // Fetch user's config (including last model)
        const userConfig = await getUserConfig(userId, supabaseAdminClient);

        const clientSafeModels = GEMINI_MODELS.map(m => ({
            displayName: m.displayName, callName: m.callName,
            capabilities: m.capabilities, notes: m.notes,
        }));

        // Determine the current model: user's preference, or default
        const currentModel = (userConfig.lastSelectedModel && GEMINI_MODELS.some(m => m.callName === userConfig.lastSelectedModel))
            ? userConfig.lastSelectedModel
            : DEFAULT_MODEL_CALL_NAME;

        res.status(200).json({
            success: true,
            models: clientSafeModels,
            currentModelCallName: currentModel, // Return user's last used or default
        });
        return; // <-- Add explicit return
    } catch (error) {
        next(error);
        return; // <-- Add explicit return
    }
});

// --- POST /call-gemini (Requires Auth) --- (Looks OK, signature is already Promise<void>)
router.post('/call-gemini', async (
    req: AuthenticatedRequest,
    res: Response<GeminiApiResponse>,
    next: NextFunction
): Promise<void> => {
    const { history, newMessage, modelCallName: requestedModelCallName } = req.body as CallGeminiRequestBody;
    const userId = req.user?.id;

    if (!userId || !supabaseAdminClient) {
         res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
         return;
    }
    if (!newMessage || !Array.isArray(history)) {
         res.status(400).json({ success: false, error: 'Invalid request body.' });
         return;
    }

    let userApiKey: string | null = null;
    let userSystemPrompt: string | null = null;
    let userLastSelectedModel: string | null = null;

    try {
        const config = await getUserConfig(userId, supabaseAdminClient);
        userApiKey = config.apiKey;
        userSystemPrompt = config.systemPrompt;
        userLastSelectedModel = config.lastSelectedModel;
    } catch (e) {
        console.error(`Error fetching user config/key/prompt for user ${userId}:`, e);
        res.status(500).json({ success: false, error: "Failed to retrieve user configuration." });
        return;
    }

    if (!userApiKey) {
        res.status(402).json({ success: false, error: 'Gemini API key not configured for this user.' });
        return;
    }

    const genAI_userSpecific = new GoogleGenerativeAI(userApiKey);

    const modelToUse = (requestedModelCallName && GEMINI_MODELS.some(m => m.callName === requestedModelCallName))
        ? requestedModelCallName
        : (userLastSelectedModel && GEMINI_MODELS.some(m => m.callName === userLastSelectedModel))
            ? userLastSelectedModel
            : DEFAULT_MODEL_CALL_NAME;

    console.log(`Gemini request for user ${userId}. Model to use: ${modelToUse}. History: ${history.length}`);

    const effectiveSystemInstruction = userSystemPrompt;
    if (effectiveSystemInstruction) console.log("Using system instruction from DB. Length:", effectiveSystemInstruction.length);
    else console.log("No system instruction found in DB for user.");

    try {
        const modelOptions: { model: string; generationConfig: GenerationConfig; systemInstruction?: string | Content; } = {
            model: modelToUse,
            generationConfig,
        };
        if (effectiveSystemInstruction && effectiveSystemInstruction.trim().length > 0) {
            modelOptions.systemInstruction = effectiveSystemInstruction;
        }

        const dynamicModel = genAI_userSpecific.getGenerativeModel(modelOptions);
        const chatSession = dynamicModel.startChat({ history });
        const result = await chatSession.sendMessage(newMessage);
        const response = result.response;

        if (response.promptFeedback?.blockReason) {
             const reason = response.promptFeedback.blockReason;
             console.warn(`Gemini API call blocked for reason: ${reason}. User: ${userId}`);
             if (reason === 'OTHER' && response.text() === undefined && result.response.candidates === undefined) {
                  res.status(403).json({ success: false, error: `API call failed. Potential API Key issue: ${reason}` });
             } else {
                  res.status(400).json({ success: false, error: `Prompt blocked by safety filter: ${reason}` });
             }
             return;
        }
        if (!response.candidates || response.candidates.length === 0) {
             res.status(500).json({ success: false, error: 'Gemini API returned no response candidates.' }); return;
        }
         const firstCandidate = response.candidates[0];
        if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
            res.status(400).json({ success: false, error: `Response stopped due to ${firstCandidate.finishReason}` }); return;
        }
        if (!firstCandidate.content?.parts || firstCandidate.content.parts.length === 0 || !firstCandidate.content.parts.some(p => p.text)) {
             res.status(500).json({ success: false, error: 'Gemini API returned no text content.' }); return;
        }

        const responseText = response.text();
        let inputTokens = 0, outputTokens = 0;

         if (response.usageMetadata) {
             inputTokens = response.usageMetadata.promptTokenCount || 0;
             outputTokens = response.usageMetadata.candidatesTokenCount || 0;
         } else {
             try {
                 const promptTokenCountResult = await dynamicModel.countTokens(newMessage); inputTokens = promptTokenCountResult.totalTokens;
                 const responseTokenCountResult = await dynamicModel.countTokens(responseText); outputTokens = responseTokenCountResult.totalTokens;
                 console.warn(`Used manual token counting for ${modelToUse}. Input: ${inputTokens}, Output: ${outputTokens}.`);
             } catch (countError: any) {
                  console.error("Error counting tokens manually:", countError);
                  if (countError.message?.includes("API_KEY") || countError.message?.includes("PERMISSION_DENIED")) {
                      res.status(403).json({ success: false, error: `Token counting failed. Check API key/billing: ${countError.message}` }); return;
                  }
             }
         }

        const { inputCost, outputCost, totalCost } = calculateCost(modelToUse, inputTokens, outputTokens);

        if (modelToUse !== userLastSelectedModel) {
            console.log(`Updating user ${userId}'s last selected model in DB to: ${modelToUse}`);
            // Use await, but maybe don't block the response if it fails, just log it
            setUserLastSelectedModel(userId, modelToUse, supabaseAdminClient)
                .catch(err => console.error(`Failed to update last selected model in DB for user ${userId}:`, err));
        }

        res.status(200).json({
            success: true, text: responseText, inputTokens, outputTokens,
            totalTokens: inputTokens + outputTokens, inputCost, outputCost, totalCost, modelUsed: modelToUse,
        });
        // No explicit return needed here as it's the end of the try block and function

    } catch (error: any) {
        console.error(`Error calling Gemini API on server for user ${userId} with model ${modelToUse}:`, error);
         if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("API key not valid")) {
             res.status(403).json({ success: false, error: `Gemini API Key Error: ${error.message}. Check key/billing.` });
             // No return needed here because res.status().json() sends the response
         } else {
             next(error); // Pass to global error handler
             // No explicit return needed here as next() passes control
         }
    }
});

// --- GET /load-system-prompt (Requires Auth) --- FIX RETURNS and ERROR HANDLING
router.get('/load-system-prompt', async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => { // Signature already includes Promise<void>
    const userId = req.user?.id;
    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return; // <-- OK
    }
    console.log(`Request received for /load-system-prompt for user ${userId}`);
    try {
        // Now that getUserSystemPrompt is imported, this line should work
        const promptContent = await getUserSystemPrompt(userId, supabaseAdminClient);
        res.status(200).json({ success: true, systemPrompt: promptContent || '' }); // Return empty string if null
        return; // <-- Add explicit return
    } catch (error: any) {
        console.error(`Error loading system prompt from DB for user ${userId}:`, error);
        // Prefer using next(error) for consistency
        // res.status(500).json({ success: false, error: "Could not load system prompt from database." });
        next(new Error("Could not load system prompt from database.")); // Pass error to global handler
        return; // <-- Add explicit return
    }
});

// --- POST /save-system-prompt (Requires Auth) --- FIX RETURNS and ERROR HANDLING
router.post('/save-system-prompt', async (
    req: AuthenticatedRequest, // Use AuthenticatedRequest
    res: Response,
    next: NextFunction
): Promise<void> => { // Signature already includes Promise<void>
    const { systemPrompt } = req.body as SaveSystemPromptBody;
    const userId = req.user?.id; // Get user ID from authenticated request

    if (!userId || !supabaseAdminClient) {
         res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
         return; // <-- OK
    }
    console.log(`Request received for /save-system-prompt (DB) for user ${userId}. Length: ${systemPrompt?.length}`);
    if (typeof systemPrompt !== 'string') {
        res.status(400).json({ success: false, error: 'systemPrompt (string) is required in the body.' });
        return; // <-- OK
    }
    try {
        const result = await setUserSystemPrompt(userId, systemPrompt, supabaseAdminClient);
        if (result.success) {
            res.status(200).json({ success: true, message: 'System prompt saved to database.' });
        } else {
            // Use next(error) for consistency if the service returns an error message
            next(new Error(result.error || 'Could not save system prompt to database.'));
            // res.status(500).json({ success: false, error: result.error || 'Could not save system prompt to database.' });
        }
        return; // <-- Add explicit return
    } catch (error: any) {
        console.error(`Error saving system prompt to DB for user ${userId}:`, error);
        // Pass error to global handler
        next(error);
        // res.status(500).json({ success: false, error: 'Could not save system prompt to database.' });
        return; // <-- Add explicit return
    }
});

export default router;