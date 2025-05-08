// backend/src/routes/geminiRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content, FinishReason, SafetyRating, StartChatParams } from "@google/generative-ai";
import { GEMINI_MODELS, calculateCost } from '../geminiModels';
import {
    SYSTEM_PROMPT_FULL_PATH,
    saveLastSelectedModel as persistSelectedModel, // Renamed for clarity
    getCurrentModelCallName,
    GEMINI_CONFIG_PATH
} from '../config/appConfig';

const router = express.Router();

const geminiApiKey: string = process.env.GEMINI_API_KEY as string;
if (!geminiApiKey) {
  console.error("FATAL: GEMINI_API_KEY not found in server environment variables.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const generationConfig: GenerationConfig = { /* ... your config ... */ }; // Keep your existing config, or make it configurable

// --- Interfaces ---
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

// --- Routes ---
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
    req: Request<{}, {}, CallGeminiRequestBody>,
    res: Response<GeminiApiResponse>,
    next: NextFunction
): Promise<void> => {
    const { history, newMessage, systemPrompt, modelCallName: requestedModelCallName } = req.body;

    if (!newMessage) {
        res.status(400).json({ success: false, error: 'newMessage is required.' });
        return;
    }
    if (!Array.isArray(history)) {
         res.status(400).json({ success: false, error: 'history must be an array.' });
         return;
    }

    const modelToUse = requestedModelCallName && GEMINI_MODELS.some(m => m.callName === requestedModelCallName)
        ? requestedModelCallName
        : getCurrentModelCallName();

    console.log(`Received Gemini request. Model: ${modelToUse}, History length: ${history.length}`);
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
        
        const dynamicModel = genAI.getGenerativeModel(modelOptions);
        const startChatParams: StartChatParams = { history };
        const chatSession = dynamicModel.startChat(startChatParams);
        const result = await chatSession.sendMessage(newMessage);
        const response = result.response;

        if (response.promptFeedback?.blockReason) {
            const reason = response.promptFeedback.blockReason;
            res.status(400).json({ success: false, error: `Prompt blocked by safety filter: ${reason}` });
            return;
        }
        // ... (rest of the response handling, token counting, cost calculation from original server.ts)
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
        } else { /* Fallback manual count */
            try {
                const promptTokenCountResult = await dynamicModel.countTokens(newMessage);
                inputTokens = promptTokenCountResult.totalTokens;
                const responseTokenCountResult = await dynamicModel.countTokens(responseText);
                outputTokens = responseTokenCountResult.totalTokens;
                console.warn(`Used manual token counting for ${modelToUse}. Input: ${inputTokens}, Output: ${outputTokens}.`);
            } catch (countError) { console.error("Error counting tokens manually:", countError); }
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
        console.error(`Error calling Gemini API on server with model ${modelToUse}:`, error);
        next(error);
    }
});

router.get('/load-system-prompt', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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