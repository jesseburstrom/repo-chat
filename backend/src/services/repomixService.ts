// backend/src/services/repomixService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs'; // Import the Node.js file system module
import * as path from 'path'; // Import the Node.js path module
import {
    MAIN_FILENAME_EXTENSION,
    SUMMARY_FILENAME_SUFFIX,
    SUMMARY_FILENAME_EXTENSION
} from '../config/appConfig'; // Import constants from your appConfig

export const USER_GENERATED_FILES_TABLE = 'user_generated_files';

// This is the full DB record structure
export interface UserGeneratedFile {
    id: string;
    user_id: string;
    filename: string;
    repo_identifier: string;
    created_at: string;
}

// This is what the listUserGeneratedFiles function will actually return in its 'data' field
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
    if (!adminClient) return { success: false, error: 'Server configuration error (admin client).' };
    try {
        const { data, error } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .insert({ user_id: userId, filename, repo_identifier: repoIdentifier })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: data as UserGeneratedFile };
    } catch (e: any) {
        console.error('Error adding user generated file to DB:', e);
        return { success: false, error: e.message || 'Failed to record generated file.' };
    }
}

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
            .single();

        if (dbSelectError || !fileRecord) {
            if (dbSelectError && dbSelectError.code !== 'PGRST116') {
                console.error(`DB error checking ownership for deletion: user ${userId}, file ${filename}`, dbSelectError);
                return { success: false, error: 'Database error verifying file ownership.' };
            }
            return { success: false, error: 'File not found or not owned by user.' };
        }

        const { error: dbDeleteError } = await adminClient
            .from(USER_GENERATED_FILES_TABLE)
            .delete()
            .eq('user_id', userId)
            .eq('filename', fileRecord.filename); // Use filename from confirmed record

        if (dbDeleteError) {
            console.error(`DB error deleting record: user ${userId}, file ${fileRecord.filename}`, dbDeleteError);
            return { success: false, error: 'Failed to delete file record from database.' };
        }

        const mainFilePath = path.join(generatedFilesDir, fileRecord.filename);
        // Construct summary filename correctly using imported constants
        const summaryBaseName = fileRecord.filename.replace(MAIN_FILENAME_EXTENSION, '');
        const summaryFilePath = path.join(generatedFilesDir, `${summaryBaseName}${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`);


        let deletionErrors: string[] = [];

        try {
            if (fs.existsSync(mainFilePath)) { // Use fs.existsSync
                await fs.promises.unlink(mainFilePath); // Use fs.promises.unlink
                console.log(`Deleted main file: ${mainFilePath}`);
            } else {
                console.warn(`Main file not found on disk for deletion: ${mainFilePath}`);
            }
        } catch (e: any) {
            console.error(`Error deleting main file ${mainFilePath} from disk:`, e);
            deletionErrors.push(`Failed to delete main file: ${e.message}`);
        }

        try {
            if (fs.existsSync(summaryFilePath)) { // Use fs.existsSync
                await fs.promises.unlink(summaryFilePath); // Use fs.promises.unlink
                console.log(`Deleted summary file: ${summaryFilePath}`);
            }
        } catch (e: any) {
            console.error(`Error deleting summary file ${summaryFilePath} from disk:`, e);
            deletionErrors.push(`Failed to delete summary file: ${e.message}`);
        }

        if (deletionErrors.length > 0) {
            // Even if physical deletion had issues, the DB record is gone.
            // It's better to report success on DB deletion and warn about physical files.
            return { success: true, message: `DB record deleted. Physical file deletion issues: ${deletionErrors.join('; ')}` };
        }

        return { success: true, message: `File '${fileRecord.filename}' and its record deleted successfully.` };

    } catch (e: any) {
        console.error(`Exception during file deletion for user ${userId}, file ${filename}:`, e);
        return { success: false, error: e.message || 'An unexpected error occurred during file deletion.' };
    }
}