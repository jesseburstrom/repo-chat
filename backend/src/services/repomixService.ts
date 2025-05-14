// backend/src/services/repomixService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs'; 
import * as path from 'path'; 
import {
    MAIN_FILENAME_EXTENSION,
    SUMMARY_FILENAME_SUFFIX,
    SUMMARY_FILENAME_EXTENSION
} from '../config/appConfig'; 

export const USER_GENERATED_FILES_TABLE = 'user_generated_files';

export interface UserGeneratedFile {
    id: string;
    user_id: string;
    filename: string;
    repo_identifier: string;
    created_at: string;
}

export interface ListedRepoInfo {
    filename: string;
    repoIdentifier: string;
}

export async function addUserGeneratedFile(
    userId: string,
    filename: string,
    repoIdentifier: string,
    adminClient: SupabaseClient
): Promise<{ success: boolean; data?: UserGeneratedFile; error?: string }> {
    if (!adminClient) {
        console.error('Admin Supabase client not initialized in addUserGeneratedFile.');
        return { success: false, error: 'Server configuration error (admin client).' };
    }

    console.log(`Adding/Updating file record for user ${userId}, filename: ${filename}`);

    try {
        // Step 1: Delete any existing records for this user and filename to prevent duplicates.
        const { error: deleteError } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .delete()
            .match({ user_id: userId, filename: filename });

        if (deleteError) {
            // Log the error but attempt to proceed with insertion.
            // This handles cases where deletion might fail for unexpected reasons,
            // but we still want to try inserting the new record.
            console.warn(`Warning: Failed to delete pre-existing record for user ${userId}, file ${filename}. Error: ${deleteError.message}. Proceeding with insert.`);
        } else {
            console.log(`Successfully deleted pre-existing record(s) for user ${userId}, file ${filename} (if any).`);
        }

        // Step 2: Insert the new record.
        // 'created_at' will typically be handled by a DB default (e.g., now()).
        const { data, error: insertError } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .insert({
                user_id: userId,
                filename: filename,
                repo_identifier: repoIdentifier
                // If your 'created_at' column doesn't have a DB default or you need specific timing,
                // you can explicitly set it: created_at: new Date().toISOString()
            })
            .select() // Select all columns of the newly inserted row
            .single(); // Expect exactly one row to be inserted and returned

        if (insertError) {
            console.error(`Error inserting new file record for user ${userId}, file ${filename}:`, insertError);
            throw insertError; // Propagate the error to be caught by the outer catch block
        }

        console.log(`Successfully inserted new file record for user ${userId}, file ${filename}. ID: ${data?.id}`);
        return { success: true, data: data as UserGeneratedFile };

    } catch (e: any) {
        // This catches errors from the insert operation or any other synchronous error in the try block.
        console.error(`Critical error in addUserGeneratedFile for user ${userId}, file ${filename}:`, e);
        return {
            success: false,
            error: e.message || `An unexpected error occurred while recording the generated file: ${filename}.`
        };
    }
}

// ... rest of the functions (listUserGeneratedFiles, deleteUserGeneratedFile) remain the same
export async function listUserGeneratedFiles(
    userId: string,
    adminClient: SupabaseClient
): Promise<{ success: boolean; data?: ListedRepoInfo[]; error?: string }> {
    if (!adminClient) return { success: false, error: 'Server configuration error (admin client).' };
    try {
        const { data, error } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .select('filename, repo_identifier')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const listedRepos: ListedRepoInfo[] = data?.map(d => ({
            filename: d.filename,
            repoIdentifier: d.repo_identifier
        })) || [];
        return { success: true, data: listedRepos };
    } catch (e: any) {
        console.error('Error listing user generated files from DB:', e);
        return { success: false, error: e.message || 'Failed to list generated files.' };
    }
}

export async function deleteUserGeneratedFile(
    userId: string,
    filename: string,
    adminClient: SupabaseClient,
    generatedFilesDir: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!adminClient) return { success: false, error: 'Server configuration error (admin client).' };

    try {
        const { data: fileRecord, error: dbSelectError } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .select('filename')
            .eq('user_id', userId)
            .eq('filename', filename)
            .single(); // .single() is appropriate here as we expect one unique file to delete

        if (dbSelectError || !fileRecord) {
            if (dbSelectError && dbSelectError.code !== 'PGRST116') { // PGRST116 means 0 rows, which is "not found"
                console.error(`DB error checking ownership for deletion: user ${userId}, file ${filename}`, dbSelectError);
                return { success: false, error: 'Database error verifying file ownership.' };
            }
            return { success: false, error: 'File not found or not owned by user.' };
        }

        const { error: dbDeleteError } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .delete()
            .eq('user_id', userId)
            .eq('filename', fileRecord.filename); 

        if (dbDeleteError) {
            console.error(`DB error deleting record: user ${userId}, file ${fileRecord.filename}`, dbDeleteError);
            return { success: false, error: 'Failed to delete file record from database.' };
        }

        const mainFilePath = path.join(generatedFilesDir, fileRecord.filename);
        const summaryBaseName = fileRecord.filename.replace(MAIN_FILENAME_EXTENSION, '');
        const summaryFilePath = path.join(generatedFilesDir, `${summaryBaseName}${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`);


        let deletionErrors: string[] = [];

        try {
            if (fs.existsSync(mainFilePath)) { 
                await fs.promises.unlink(mainFilePath); 
                console.log(`Deleted main file: ${mainFilePath}`);
            } else {
                console.warn(`Main file not found on disk for deletion: ${mainFilePath}`);
            }
        } catch (e: any) {
            console.error(`Error deleting main file ${mainFilePath} from disk:`, e);
            deletionErrors.push(`Failed to delete main file: ${e.message}`);
        }

        try {
            if (fs.existsSync(summaryFilePath)) { 
                await fs.promises.unlink(summaryFilePath); 
                console.log(`Deleted summary file: ${summaryFilePath}`);
            }
        } catch (e: any) {
            console.error(`Error deleting summary file ${summaryFilePath} from disk:`, e);
            deletionErrors.push(`Failed to delete summary file: ${e.message}`);
        }

        if (deletionErrors.length > 0) {
            return { success: true, message: `DB record deleted. Physical file deletion issues: ${deletionErrors.join('; ')}` };
        }

        return { success: true, message: `File '${fileRecord.filename}' and its record deleted successfully.` };

    } catch (e: any) {
        console.error(`Exception during file deletion for user ${userId}, file ${filename}:`, e);
        return { success: false, error: e.message || 'An unexpected error occurred during file deletion.' };
    }
}