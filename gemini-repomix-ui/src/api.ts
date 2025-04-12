// src/api.ts
import { GoogleGenerativeAI, HarmCategory, GenerationConfig, Content, FinishReason, SafetyRating } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not set in the environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

const generationConfig: GenerationConfig = {
  temperature: 0.7, // Adjust as needed
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192, // Adjust as needed
  responseMimeType: "text/plain",
};

// Define safety settings if needed, otherwise use defaults
// const safetySettings = [
//     { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
// ];


const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro-exp-03-25", // Or choose another model like gemini-1.5-pro
  // safetySettings, // Uncomment if you defined custom safety settings
  generationConfig,
});

// --- Helper Function Definition (Moved Here) ---
function formatSafetyRatings(ratings: SafetyRating[] | undefined): string {
  if (!ratings || ratings.length === 0) {
      return 'No safety rating details available.';
  }
  // Map category enum to a shorter string representation if desired
  const formatCategory = (category: HarmCategory) => category.replace('HARM_CATEGORY_', '');
  return ratings.map(r => `${formatCategory(r.category)} (${r.probability})`).join(', ');
}
// --- End Helper Function ---

export interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

export async function callGeminiApi(history: Content[], newMessage: string): Promise<string> {
  try {
    console.log("Sending to Gemini - History:", history);
    console.log("Sending to Gemini - Message:", newMessage);

    const chatSession = model.startChat({
      history: history,
      // safetySettings: safetySettings // Apply here if needed per-session
    });

    const result = await chatSession.sendMessage(newMessage);
    const response = result.response; // Use variable for easier access

    // --- CORRECTED Error/Block Handling ---

    // 1. Check Prompt Feedback for blocking
    if (response.promptFeedback?.blockReason) {
        const reason = response.promptFeedback.blockReason;
        const ratings = response.promptFeedback.safetyRatings;
        console.error(`Prompt blocked due to ${reason}. Ratings:`, ratings);
        const ratingDetails = formatSafetyRatings(ratings);
        return `Error: Your prompt was blocked. Reason: ${reason}. Details: [${ratingDetails}]`;
    }

    // 2. Check if candidates exist
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      // This case might also happen if the prompt was blocked but didn't set promptFeedback explicitly
      console.error("No candidates received in response. Checking prompt feedback again:", response.promptFeedback);
      const reason = response.promptFeedback?.blockReason || "Unknown reason";
      const ratingDetails = formatSafetyRatings(response.promptFeedback?.safetyRatings);
      return `Error: Received no response candidates from the API. Prompt may have been blocked (Reason: ${reason}, Details: [${ratingDetails}]).`;
    }

    const firstCandidate = candidates[0];

    // 3. Check Candidate Finish Reason for issues other than STOP
    // Use FinishReason enum for reliable comparison
    if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
      const reason = firstCandidate.finishReason;
      const ratings = firstCandidate.safetyRatings;
      console.error(`Response generation finished reason: ${reason}. Safety Ratings:`, ratings);

      if (reason === FinishReason.SAFETY) {
         const ratingDetails = formatSafetyRatings(ratings);
         return `Error: The response was blocked or stopped due to safety settings. Reason: ${reason}. Details: [${ratingDetails}]`;
      }
      else if (reason === FinishReason.RECITATION) {
           return `Error: Response stopped due to potential recitation of copyrighted material. Reason: ${reason}.`;
      }
      else if (reason === FinishReason.MAX_TOKENS) {
          // Try to return partial content if available
          const partialText = firstCandidate.content?.parts?.map(p => p.text).join('') || '';
          console.warn("Response truncated due to max tokens limit.");
          return partialText ? `${partialText}... [Output truncated due to token limit]` : `Error: Response generation stopped due to maximum token limit. No partial content available. Reason: ${reason}.`;
      }
      else {
         // Handle other potential finish reasons (OTHER, UNSPECIFIED, etc.)
         return `Error: Response generation finished unexpectedly. Reason: ${reason}.`;
      }
    }

    // 4. Check for actual content in the candidate (even if finishReason was STOP)
    if (!firstCandidate.content?.parts || firstCandidate.content.parts.length === 0 || !firstCandidate.content.parts.some(p => p.text)) {
      console.error("No valid text content parts in the response candidate despite STOP reason:", firstCandidate);
      return "Error: Received response with no valid text content from the API.";
    }

    // --- End CORRECTED Handling ---


    // Assuming text/plain response mime type
    const responseText = result.response.text();
    console.log("Received from Gemini:", responseText); // Debug log
    return responseText;

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    // Provide more specific error messages if possible
    if (error.message.includes('API key not valid')) {
      return "Error: Invalid Gemini API Key. Please check your .env file.";
    }
     if (error.message.includes('429')) {
         return "Error: Rate limit exceeded. Please wait and try again.";
     }
    return `Error communicating with Gemini API: ${error.message}`;
  }
}