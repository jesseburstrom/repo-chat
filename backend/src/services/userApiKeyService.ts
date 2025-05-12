// backend/src/services/userApiKeyService.ts
import { SupabaseClient } from '@supabase/supabase-js';

const USER_GEMINI_KEYS_TABLE = 'user_gemini_keys';
const USER_SYSTEM_PROMPTS_TABLE = 'user_system_prompts';

export interface UserConfig {
    apiKey: string | null;
    lastSelectedModel: string | null;
    systemPrompt: string | null;
}

// --- Combined Fetch Function ---
export async function getUserConfig(
    userId: string,
    adminClient: SupabaseClient
): Promise<UserConfig> {
    if (!adminClient) {
        console.error('Admin Supabase client not initialized in getUserConfig.');
        // Return default/empty config on error
        return { apiKey: null, lastSelectedModel: null, systemPrompt: null };
    }

    let apiKey: string | null = null;
    let lastSelectedModel: string | null = null;
    let systemPrompt: string | null = null;

    try {
        // Fetch from user_gemini_keys
        const { data: keyData, error: keyError } = await adminClient
            .from(USER_GEMINI_KEYS_TABLE)
            .select('api_key, last_selected_model')
            .eq('user_id', userId)
            .single();

        if (keyError && keyError.code !== 'PGRST116') { // Ignore "no rows" error
            console.error('Error fetching user key/model config:', keyError);
        } else if (keyData) {
            apiKey = keyData.api_key || null;
            lastSelectedModel = keyData.last_selected_model || null;
        }

        // Fetch from user_system_prompts
        const { data: promptData, error: promptError } = await adminClient
            .from(USER_SYSTEM_PROMPTS_TABLE)
            .select('prompt_content')
            .eq('user_id', userId)
            .single();

        if (promptError && promptError.code !== 'PGRST116') { // Ignore "no rows" error
            console.error('Error fetching user system prompt:', promptError);
        } else if (promptData) {
            systemPrompt = promptData.prompt_content || null;
        }

    } catch (e) {
        console.error('Exception fetching user config:', e);
    }

    return { apiKey, lastSelectedModel, systemPrompt };
}


// --- Get specific parts (can still be useful) ---
export async function getUserGeminiApiKey(
    userId: string,
    adminClient: SupabaseClient
): Promise<string | null> {
     if (!adminClient) return null;
     try {
         const { data, error } = await adminClient
             .from(USER_GEMINI_KEYS_TABLE).select('api_key').eq('user_id', userId).single();
         if (error && error.code !== 'PGRST116') throw error;
         return data?.api_key || null;
     } catch (e) { console.error('Error fetching API key:', e); return null; }
}

export async function getUserSystemPrompt(
    userId: string,
    adminClient: SupabaseClient
): Promise<string | null> {
    if (!adminClient) return null;
    try {
         const { data, error } = await adminClient
             .from(USER_SYSTEM_PROMPTS_TABLE).select('prompt_content').eq('user_id', userId).single();
         if (error && error.code !== 'PGRST116') throw error;
         return data?.prompt_content || null;
    } catch (e) { console.error('Error fetching system prompt:', e); return null; }
}

// --- Set specific parts ---
export async function setUserGeminiApiKey(
    userId: string,
    apiKey: string,
    adminClient: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
    if (!adminClient) return { success: false, error: 'Server configuration error.' };

    try {
        if (!apiKey || apiKey.trim() === '') {
            // Delete or clear the key part only
             const { error } = await adminClient
                 .from(USER_GEMINI_KEYS_TABLE)
                 .update({ api_key: null, updated_at: new Date().toISOString() }) // Set key to null
                 .eq('user_id', userId);
             if (error) throw error;
        } else {
            // Upsert the API key, leaving other columns potentially managed elsewhere
            const { error } = await adminClient
                .from(USER_GEMINI_KEYS_TABLE)
                .upsert({ user_id: userId, api_key: apiKey, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            if (error) throw error;
        }
        return { success: true };
    } catch (e: any) {
        console.error('Exception setting/deleting user Gemini API key:', e);
        return { success: false, error: e.message || 'Failed to update API key.' };
    }
}

export async function setUserLastSelectedModel(
    userId: string,
    modelCallName: string | null, // Allow setting to null? Or just pass valid names
    adminClient: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
    if (!adminClient) return { success: false, error: 'Server configuration error.' };

    try {
        const { error, count } = await adminClient
        .from(USER_GEMINI_KEYS_TABLE)
        .update({ // Specify only the columns to update
            last_selected_model: modelCallName,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId); // Only update the existing row for this user

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error('Exception setting user last selected model:', e);
        return { success: false, error: e.message || 'Failed to set last selected model.' };
    }
}

export async function setUserSystemPrompt(
    userId: string,
    promptContent: string, // Assuming empty string means "clear"
    adminClient: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
     if (!adminClient) return { success: false, error: 'Server configuration error.' };

     try {
        const { error } = await adminClient
            .from(USER_SYSTEM_PROMPTS_TABLE)
            .upsert({ user_id: userId, prompt_content: promptContent, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

        if (error) throw error;
        return { success: true };
     } catch (e: any) {
         console.error('Exception setting user system prompt:', e);
         return { success: false, error: e.message || 'Failed to set system prompt.' };
     }
}