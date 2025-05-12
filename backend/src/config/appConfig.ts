// backend/src/config/appConfig.ts
import * as path from 'path';
import * as fs from 'fs';
import { GEMINI_MODELS, DEFAULT_MODEL_CALL_NAME } from '../geminiModels'; // Keep DEFAULT
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- Supabase config remains the same ---
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("FATAL: Supabase URL or Anon Key not found in server environment variables.");
    // process.exit(1); // Consider if startup should fail
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("WARNING: Supabase Service Role Key not found. Some backend operations requiring admin privileges might fail.");
}

export const supabaseBackendClient = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
export const supabaseAdminClient: SupabaseClient | null = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// --- Repomix generated files config remains ---
export const GENERATED_FILES_DIR = path.resolve(__dirname, '..', '..', '..', 'generated_files');
export const TEMP_FILENAME_PREFIX = 'temp_repomix_output';
export const MAIN_FILENAME_EXTENSION = '.md';
export const SUMMARY_FILENAME_EXTENSION = '.txt';
export const SUMMARY_FILENAME_SUFFIX = '_pack_summary';

// --- REMOVED System Prompt / Gemini Config File Paths & Vars ---
// export const SYSTEM_PROMPT_FILENAME = 'system_prompt.txt';
// export const SYSTEM_PROMPT_FULL_PATH = path.join(GENERATED_FILES_DIR, SYSTEM_PROMPT_FILENAME);
// const GEMINI_CONFIG_FILENAME = 'gemini_config.json';
// export const GEMINI_CONFIG_PATH = path.resolve(__dirname, '..', GEMINI_CONFIG_FILENAME);
// export let currentSelectedModelCallName = DEFAULT_MODEL_CALL_NAME; // REMOVED GLOBAL CACHE

// --- Directory init remains (for Repomix output) ---
export function initGeneratedFilesDir() {
    if (!fs.existsSync(GENERATED_FILES_DIR)) {
        console.log(`Creating directory for generated files: ${GENERATED_FILES_DIR}`);
        try {
            fs.mkdirSync(GENERATED_FILES_DIR, { recursive: true });
        } catch (err) {
            console.error("FATAL: Could not create generated_files directory.", err);
            process.exit(1);
        }
    }
}

// --- REMOVED loadLastSelectedModel, saveLastSelectedModel ---
// --- REMOVED getCurrentModelCallName ---

// Initialize generated files dir on import
initGeneratedFilesDir();

// --- NOTE: Default model name is now just a constant ---
// console.log(`Default Gemini model fallback: ${DEFAULT_MODEL_CALL_NAME}`); // Can log if needed