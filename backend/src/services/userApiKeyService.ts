// backend/src/services/userApiKeyService.ts
import { SupabaseClient } from '@supabase/supabase-js';

const USER_GEMINI_KEYS_TABLE = 'user_gemini_keys';

export async function getUserGeminiApiKey(
    userId: string,
    adminClient: SupabaseClient
): Promise<string | null> {
    if (!adminClient) {
        console.error('Admin Supabase client not initialized in getUserGeminiApiKey.');
        return null;
    }
    try {
        const { data, error } = await adminClient
            .from(USER_GEMINI_KEYS_TABLE)
            .select('api_key')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: "Searched for a single row, but found no rows" - this is not an error for us
            console.error('Error fetching user Gemini API key:', error);
            return null;
        }
        return data?.api_key || null;
    } catch (e) {
        console.error('Exception fetching user Gemini API key:', e);
        return null;
    }
}

export async function setUserGeminiApiKey(
    userId: string,
    apiKey: string,
    adminClient: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
    if (!adminClient) {
        console.error('Admin Supabase client not initialized in setUserGeminiApiKey.');
        return { success: false, error: 'Server configuration error.' };
    }
    if (!apiKey || apiKey.trim() === '') {
        // If an empty key is provided, delete the existing key for the user.
        try {
             const { error: deleteError } = await adminClient
                 .from(USER_GEMINI_KEYS_TABLE)
                 .delete()
                 .eq('user_id', userId);

             if (deleteError) {
                 console.error('Error deleting user Gemini API key:', deleteError);
                 return { success: false, error: deleteError.message };
             }
             return { success: true };
        } catch (e: any) {
             console.error('Exception deleting user Gemini API key:', e);
             return { success: false, error: e.message || 'Failed to delete API key.' };
        }
    }

    try {
        const { error } = await adminClient
            .from(USER_GEMINI_KEYS_TABLE)
            .upsert({ user_id: userId, api_key: apiKey, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

        if (error) {
            console.error('Error setting user Gemini API key:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        console.error('Exception setting user Gemini API key:', e);
        return { success: false, error: e.message || 'Failed to set API key.' };
    }
}