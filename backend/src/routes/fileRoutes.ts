// backend/src/routes/fileRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import { constants as fsConstants } from 'fs';
import * as path from 'path';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import {
    supabaseAdminClient,
    GENERATED_FILES_DIR,
    MAIN_FILENAME_EXTENSION,
    SUMMARY_FILENAME_SUFFIX,
    SUMMARY_FILENAME_EXTENSION
} from '../config/appConfig';
import {
    listUserGeneratedFiles,
    deleteUserGeneratedFile,
    USER_GENERATED_FILES_TABLE, // For direct DB checks if necessary
    ListedRepoInfo // Type for listing
} from '../services/repomixService';

const router = express.Router();

// --- Response Interfaces ---
interface ListGeneratedFilesClientResponse { // Renamed to avoid conflict if api.ts uses same name
    success: boolean;
    data?: ListedRepoInfo[]; // Uses the type from repomixService
    error?: string;
}

interface GetFileContentClientResponse {
    success: boolean;
    content?: string;
    error?: string;
}

interface DeleteFileClientResponse {
    success: boolean;
    message?: string;
    error?: string;
}

// --- Route: List Generated Files for User ---
router.get('/list-generated-files', async (req: AuthenticatedRequest, res: Response<ListGeneratedFilesClientResponse>, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }
    console.log(`Request received for /list-generated-files for user ${userId}`);

    try {
        const result = await listUserGeneratedFiles(userId, supabaseAdminClient);
        if (result.success) {
            res.status(200).json({ success: true, data: result.data || [] });
        } else {
            console.error(`Error from listUserGeneratedFiles service for user ${userId}:`, result.error);
            throw new Error(result.error || 'Failed to list files from database.');
        }
    } catch (error: any) {
        console.error(`Error in /list-generated-files endpoint for user ${userId}:`, error);
        if (!res.headersSent) {
             next(error);
        }
    }
});

// --- Route: Get Content of a Specific File ---
router.get('/get-file-content/:filename', async (req: AuthenticatedRequest, res: Response<GetFileContentClientResponse>, next: NextFunction): Promise<void> => {
    const requestedFilename = req.params.filename;
    const userId = req.user?.id;

    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }
    console.log(`Request received for /get-file-content/${requestedFilename} for user ${userId}`);

    const safeFilenameRegex = /^[a-zA-Z0-9_.-]+(\.md|_pack_summary\.txt)$/;
    if (!requestedFilename || !safeFilenameRegex.test(requestedFilename) || requestedFilename.includes('/') || requestedFilename.includes('..')) {
        res.status(400).json({ success: false, error: 'Invalid filename format.' });
        return;
    }

    const resolvedPath = path.join(GENERATED_FILES_DIR, requestedFilename);
    const normalizedPath = path.normalize(resolvedPath);

    if (!normalizedPath.startsWith(path.resolve(GENERATED_FILES_DIR))) {
        console.error(`Path traversal attempt detected: ${requestedFilename} resolved to ${normalizedPath} (user ${userId})`);
        res.status(400).json({ success: false, error: 'Invalid filename (path traversal attempt).' });
        return;
    }

    try {
        // Security: Verify the user owns this file record in the DB.
        const { data: fileRecord, error: dbError } = await supabaseAdminClient
            .from(USER_GENERATED_FILES_TABLE)
            .select('id')
            .eq('user_id', userId)
            .eq('filename', requestedFilename)
            .maybeSingle();

        if (dbError) {
            console.error(`Database error checking file auth for ${requestedFilename} (user ${userId}):`, dbError);
            throw new Error('Database error during file authorization.');
        }

        let allowAccess = !!fileRecord;

        // Special handling for summary files if they are not directly in user_generated_files
        // This logic assumes summary files are named based on main files.
        if (!allowAccess && requestedFilename.endsWith(`${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`)) {
            const mainFileName = requestedFilename.replace(`${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`, MAIN_FILENAME_EXTENSION);
            const { data: mainFileRecord, error: mainDbError } = await supabaseAdminClient
                .from(USER_GENERATED_FILES_TABLE)
                .select('id')
                .eq('user_id', userId)
                .eq('filename', mainFileName)
                .maybeSingle();

            if (mainDbError) {
                console.error(`Database error checking summary's main file auth for ${requestedFilename} (user ${userId}):`, mainDbError);
                // Don't throw here, just means we can't confirm via main file
            }
            if (mainFileRecord) {
                allowAccess = true; // Allow access to summary if user owns the main file
            }
        }

        if (!allowAccess) {
            console.warn(`User ${userId} attempt to access ${requestedFilename} not authorized by DB record.`);
            res.status(403).json({ success: false, error: 'File not authorized for this user or not found in user records.' });
            return;
        }

        await fs.promises.access(normalizedPath, fsConstants.R_OK);
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');
        res.status(200).json({ success: true, content: content });

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`File not found on filesystem: ${normalizedPath} (user ${userId})`);
            res.status(404).json({ success: false, error: 'File not found on server.' });
        } else if (error.code === 'EACCES') {
            console.error(`Permission issue reading file: ${normalizedPath} (user ${userId})`);
            res.status(500).json({ success: false, error: 'Could not read file (permission issue).' });
        } else {
            console.error(`Error in /get-file-content/${requestedFilename} for user ${userId}:`, error);
            if (!res.headersSent) {
                next(error);
            }
        }
    }
});

// --- Route: Delete a Specific File for User ---
router.delete('/delete-file/:filename', async (req: AuthenticatedRequest, res: Response<DeleteFileClientResponse>, next: NextFunction) => {
    const userId = req.user?.id;
    const filenameToDelete = req.params.filename;

    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }

    // Only allow deleting .md files directly via this route. Summary files are deleted along with main file.
    const safeFilenameRegex = /^[a-zA-Z0-9_.-]+(\.md)$/;
    if (!filenameToDelete || !safeFilenameRegex.test(filenameToDelete) || filenameToDelete.includes('/') || filenameToDelete.includes('..')) {
        res.status(400).json({ success: false, error: 'Invalid filename format for deletion. Only .md files can be directly deleted.' });
        return;
    }

    console.log(`Request to delete file: ${filenameToDelete} for user ${userId}`);

    try {
        const result = await deleteUserGeneratedFile(userId, filenameToDelete, supabaseAdminClient, GENERATED_FILES_DIR);
        if (result.success) {
            res.status(200).json({ success: true, message: result.message });
        } else {
            if (result.error?.includes('not found or not owned')) {
                res.status(404).json({ success: false, error: result.error });
            } else if (result.error?.includes('Database error')) {
                res.status(500).json({ success: false, error: result.error });
            } else if (result.message && result.error) { // Partial success (DB deleted, file issue)
                res.status(207).json({ success: false, message: result.message, error: result.error });
            }
            else { // General failure
                 res.status(500).json({ success: false, error: result.error || "Failed to delete file."});
            }
        }
    } catch (error: any) { // Catch unexpected errors from the service call itself
        console.error(`Unexpected error in /delete-file endpoint for user ${userId}, file ${filenameToDelete}:`, error);
        if (!res.headersSent) {
            next(error);
        }
    }
});

export default router;