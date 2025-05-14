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
    USER_GENERATED_FILES_TABLE, 
    ListedRepoInfo 
} from '../services/repomixService';

const router = express.Router();

interface ListGeneratedFilesClientResponse {
    success: boolean;
    data?: ListedRepoInfo[];
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

router.get('/list-generated-files', async (req: AuthenticatedRequest, res: Response<ListGeneratedFilesClientResponse>, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }
    // console.log(`Request received for /list-generated-files for user ${userId}`); // Optional: keep for debugging

    try {
        const result = await listUserGeneratedFiles(userId, supabaseAdminClient);
        if (result.success) {
            res.status(200).json({ success: true, data: result.data || [] });
        } else {
            console.error(`Error from listUserGeneratedFiles service for user ${userId}:`, result.error);
            // Pass a generic error or the specific one if safe
            next(new Error('Failed to list files from database.'));
        }
    } catch (error: any) {
        console.error(`Error in /list-generated-files endpoint for user ${userId}:`, error);
        if (!res.headersSent) {
             next(error); // Pass to global error handler
        }
    }
});

router.get('/get-file-content/:filename', async (req: AuthenticatedRequest, res: Response<GetFileContentClientResponse>, next: NextFunction): Promise<void> => {
    const requestedFilename = req.params.filename;
    const userId = req.user?.id;

    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }
    // console.log(`Request received for /get-file-content/${requestedFilename} for user ${userId}`); // Optional

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
        const { data: fileRecord, error: dbError } = await supabaseAdminClient
            .from(USER_GENERATED_FILES_TABLE)
            .select('id')
            .eq('user_id', userId)
            .eq('filename', requestedFilename)
            .maybeSingle();

        if (dbError) {
            console.error(`Database error checking file auth for ${requestedFilename} (user ${userId}):`, dbError);
            return next(new Error('Database error during file authorization.')); // Use next for error handling
        }

        let allowAccess = !!fileRecord;

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
            }
            if (mainFileRecord) {
                allowAccess = true;
            }
        }

        if (!allowAccess) {
            console.warn(`User ${userId} attempt to access ${requestedFilename} not authorized by DB record.`);
            res.status(403).json({ success: false, error: 'File not authorized for this user or not found in user records.' });
            return;
        }

        await fs.promises.access(normalizedPath, fsConstants.R_OK);
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');

        // ---> ADD CACHE CONTROL HEADERS <---
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache'); // HTTP 1.0 backward compatibility
        res.setHeader('Expires', '0'); // Proxies
        // ---> END OF ADDED HEADERS <---

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
                next(error); // Pass to global error handler
            }
        }
    }
});

router.delete('/delete-file/:filename', async (req: AuthenticatedRequest, res: Response<DeleteFileClientResponse>, next: NextFunction) => {
    const userId = req.user?.id;
    const filenameToDelete = req.params.filename;

    if (!userId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }

    const safeFilenameRegexMd = /^[a-zA-Z0-9_.-]+(\.md)$/; // Renamed for clarity
    if (!filenameToDelete || !safeFilenameRegexMd.test(filenameToDelete) || filenameToDelete.includes('/') || filenameToDelete.includes('..')) {
        res.status(400).json({ success: false, error: 'Invalid filename format for deletion. Only .md files can be directly deleted.' });
        return;
    }

    // console.log(`Request to delete file: ${filenameToDelete} for user ${userId}`); // Optional

    try {
        const result = await deleteUserGeneratedFile(userId, filenameToDelete, supabaseAdminClient, GENERATED_FILES_DIR);
        if (result.success) {
            res.status(200).json({ success: true, message: result.message });
        } else {
            if (result.error?.includes('not found or not owned')) {
                res.status(404).json({ success: false, error: result.error });
            } else if (result.error?.includes('Database error')) {
                res.status(500).json({ success: false, error: result.error }); // Keep as 500 for DB issues
            } else if (result.message && result.error) { 
                res.status(207).json({ success: false, message: result.message, error: result.error });
            }
            else { 
                 res.status(500).json({ success: false, error: result.error || "Failed to delete file."});
            }
        }
    } catch (error: any) { 
        console.error(`Unexpected error in /delete-file endpoint for user ${userId}, file ${filenameToDelete}:`, error);
        if (!res.headersSent) {
            next(error); // Pass to global error handler
        }
    }
});

export default router;