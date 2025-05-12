// backend/src/routes/fileRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import { constants as fsConstants } from 'fs';
import * as path from 'path';
import {
    GENERATED_FILES_DIR,
    MAIN_FILENAME_EXTENSION,
    SUMMARY_FILENAME_SUFFIX,
    SUMMARY_FILENAME_EXTENSION,
} from '../config/appConfig';

const router = express.Router();

router.get('/list-generated-files', async (req: Request, res: Response, next: NextFunction) => {
    console.log(`Request received for /list-generated-files`);
    try {
        const files = await fs.promises.readdir(GENERATED_FILES_DIR);
        const repoFiles = files
            .map(filename => {
                const isSummaryFile = filename.endsWith(`${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`);
                const isMainFile = filename.endsWith(MAIN_FILENAME_EXTENSION);
                if (isMainFile && !isSummaryFile) {
                    const baseName = filename.slice(0, -MAIN_FILENAME_EXTENSION.length);
                     const parts = baseName.split('_');
                     if (parts.length >= 2) {
                        const user = parts.slice(0, -1).join('_');
                        const repo = parts[parts.length - 1];
                        const repoIdentifier = `${user}/${repo}`;
                        return { filename, repoIdentifier };
                     }
                }
                return null;
            })
            .filter(item => item !== null)
            .sort((a, b) => (a!.repoIdentifier).localeCompare(b!.repoIdentifier));
        console.log(`Found ${repoFiles.length} main repo files.`);
        res.status(200).json({ success: true, data: repoFiles });
    } catch (error: any) {
        console.error("Error listing generated files:", error);
        if (error.code === 'ENOENT') {
            res.status(200).json({ success: true, data: [] }); // No directory, so no files
        } else {
            next(error);
        }
    }
});

router.get('/get-file-content/:filename', async (req: Request<{ filename: string }>, res: Response, next: NextFunction): Promise<void> => {
    const requestedFilename = req.params.filename;
    console.log(`Request received for /get-file-content/${requestedFilename}`);

    const safeFilenameRegex = /^[a-zA-Z0-9_.-]+(\.md|_pack_summary\.txt)$/;
    const resolvedPath = path.join(GENERATED_FILES_DIR, requestedFilename);
    const normalizedPath = path.normalize(resolvedPath);

    if (!requestedFilename || requestedFilename.includes('/') || requestedFilename.includes('..')) {
         res.status(400).json({ success: false, error: 'Invalid filename format.' });
         return;
    }
    if (!safeFilenameRegex.test(requestedFilename)) {
        console.warn(`Filename does not match expected pattern: ${requestedFilename}`);
        res.status(400).json({ success: false, error: 'Invalid filename format. Only .md or _pack_summary.txt allowed.' });
    }
    if (!normalizedPath.startsWith(GENERATED_FILES_DIR)) {
        console.error(`Path traversal attempt detected: ${requestedFilename} resolved to ${normalizedPath}`);
        res.status(400).json({ success: false, error: 'Invalid filename.' });
        return;
    }
    try {
        await fs.promises.access(normalizedPath, fsConstants.R_OK);
        const content = await fs.promises.readFile(normalizedPath, 'utf-8');
        res.status(200).json({ success: true, content: content });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ success: false, error: 'File not found.' });
        } else if (error.code === 'EACCES') {
             res.status(500).json({ success: false, error: 'Could not read file (permission issue).' });
        } else {
            next(error);
        }
    }
});

export default router;