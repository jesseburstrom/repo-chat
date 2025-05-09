// backend/src/config/appConfig.ts
import * as path from 'path';

import * as fs from 'fs';
import { GEMINI_MODELS, DEFAULT_MODEL_CALL_NAME as DEFAULT_MODEL } from '../geminiModels';

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // For initializing client
// export const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET; // JWT Secret for manual verification

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { // SUPABASE_JWT_SECRET only if manually verifying
    console.error("FATAL: Supabase URL or Anon Key not found in server environment variables.");
    // process.exit(1); // Consider if startup should fail
}

// Initialize Supabase client for backend (e.g., for token verification via getUser)
// Use anon key here; service_role key is for bypassing RLS, which we don't need for just verifying a JWT.
export const supabaseBackendClient = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const GENERATED_FILES_DIR = path.resolve(__dirname, '..', '..', '..', 'generated_files');
export const TEMP_FILENAME_PREFIX = 'temp_repomix_output';
export const MAIN_FILENAME_EXTENSION = '.md';
export const SUMMARY_FILENAME_EXTENSION = '.txt';
export const SUMMARY_FILENAME_SUFFIX = '_pack_summary';

export const SYSTEM_PROMPT_FILENAME = 'system_prompt.txt';
export const SYSTEM_PROMPT_FULL_PATH = path.join(GENERATED_FILES_DIR, SYSTEM_PROMPT_FILENAME);

const GEMINI_CONFIG_FILENAME = 'gemini_config.json';
export const GEMINI_CONFIG_PATH = path.resolve(__dirname, '..', GEMINI_CONFIG_FILENAME); // Store it next to src/

export let currentSelectedModelCallName = DEFAULT_MODEL;


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

export function loadLastSelectedModel() {
    try {
        if (fs.existsSync(GEMINI_CONFIG_PATH)) {
            const configData = fs.readFileSync(GEMINI_CONFIG_PATH, 'utf-8');
            const config = JSON.parse(configData);
            if (config.lastSelectedModel && GEMINI_MODELS.some(m => m.callName === config.lastSelectedModel)) {
                currentSelectedModelCallName = config.lastSelectedModel;
                console.log(`Loaded last selected model: ${currentSelectedModelCallName}`);
            } else {
                console.log(`Last selected model in config not valid or not found, using default: ${DEFAULT_MODEL}`);
                saveLastSelectedModel(DEFAULT_MODEL); // Save default if invalid
            }
        } else {
            console.log(`Gemini config file not found, creating with default model: ${DEFAULT_MODEL}`);
            saveLastSelectedModel(DEFAULT_MODEL);
        }
    } catch (error) {
        console.error("Error loading Gemini config, using default:", error);
        currentSelectedModelCallName = DEFAULT_MODEL;
    }
}

export function saveLastSelectedModel(modelCallName: string) {
    try {
        const config = { lastSelectedModel: modelCallName };
        fs.writeFileSync(GEMINI_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        currentSelectedModelCallName = modelCallName; // Update in-memory state
        console.log(`Saved last selected model: ${modelCallName}`);
    } catch (error) {
        console.error("Error saving Gemini config:", error);
    }
}

export function getCurrentModelCallName(): string {
    return currentSelectedModelCallName;
}

// Initialize on import
initGeneratedFilesDir();
loadLastSelectedModel();