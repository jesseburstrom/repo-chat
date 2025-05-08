// backend/src/routes/repomixRoutes.ts
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import {
    GENERATED_FILES_DIR,
    TEMP_FILENAME_PREFIX,
    MAIN_FILENAME_EXTENSION,
    SUMMARY_FILENAME_SUFFIX,
    SUMMARY_FILENAME_EXTENSION,
} from '../config/appConfig';
import { generateSafeRepoPartsFromUrl } from '../utils/requestUtils';

const router = express.Router();

interface RunRepomixRequestBody {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}

router.post('/run-repomix', (req: Request<{}, {}, RunRepomixRequestBody>, res: Response, next: NextFunction): void => {
    const { repoUrl, includePatterns, excludePatterns } = req.body;
    if (!repoUrl) {
        res.status(400).json({ success: false, error: 'repoUrl is required' });
        return;
    }
    const repoPartsResult = generateSafeRepoPartsFromUrl(repoUrl);
    if (!repoPartsResult.success || !repoPartsResult.safeUser || !repoPartsResult.safeRepo) {
        res.status(400).json({ success: false, error: repoPartsResult.error || 'Failed to generate filename parts from URL.' });
        return;
    }
    const { safeUser, safeRepo } = repoPartsResult;
    const mainBaseFilename = `${safeUser}_${safeRepo}`;
    const finalMainFilename = `${mainBaseFilename}${MAIN_FILENAME_EXTENSION}`;
    const summaryFilename = `${mainBaseFilename}${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`;
    const tempOutputFilename = `${TEMP_FILENAME_PREFIX}_${mainBaseFilename}_${Date.now()}${MAIN_FILENAME_EXTENSION}`;
    const tempFullOutputPath = path.join(GENERATED_FILES_DIR, tempOutputFilename);
    const finalMainFullOutputPath = path.join(GENERATED_FILES_DIR, finalMainFilename);
    const summaryFullOutputPath = path.join(GENERATED_FILES_DIR, summaryFilename);
    const repomixExecutable = "npx repomix"; // Consider making this configurable
    let command = `${repomixExecutable} --remote "${repoUrl}" --output "${tempFullOutputPath}" --style xml`;
    if (includePatterns) command += ` --include "${includePatterns}"`;
    if (excludePatterns) command += ` --ignore "${excludePatterns}"`;

    if (fs.existsSync(tempFullOutputPath)) {
        try { fs.unlinkSync(tempFullOutputPath); } catch (e) { console.warn("Could not delete pre-existing temp file:", e); }
    }

    console.log(`Executing Repomix: ${command}`);
    exec(command, { timeout: 300000, maxBuffer: 1024 * 1024 * 5 }, async (error, stdout, stderr) => {
        if (error) {
             if (fs.existsSync(tempFullOutputPath)) {
                  try { fs.unlinkSync(tempFullOutputPath); } catch (e) { /* ignore */ }
             }
             if (!res.headersSent) {
                  res.status(500).json({ success: false, error: `Repomix execution failed: ${error.message}`, stderr: stderr, stdout: stdout });
             }
            return;
        }
        if (stderr) console.warn(`Repomix stderr output:\n${stderr}`);
        if (!fs.existsSync(tempFullOutputPath)) {
             if (!res.headersSent) {
                  res.status(500).json({ success: false, error: 'Repomix finished, but the temporary output file was not created.', stdout: stdout, stderr: stderr });
              }
            return;
        }
        let summarySaved = false;
        let cleanedSummaryString = '';
        try {
            const lines = stdout.split('\n');
            let summaryStartIndex = -1;
            let summaryEndIndex = -1;
            const startMarker = 'pack summary';
            const endMarker = '🎉 all done!';
            for (let i = 0; i < lines.length; i++) {
                const lineLower = lines[i].toLowerCase();
                if (summaryStartIndex === -1 && lineLower.includes(startMarker)) summaryStartIndex = i;
                if (summaryStartIndex !== -1 && lineLower.includes(endMarker) && i > summaryStartIndex) {
                    summaryEndIndex = i;
                    break;
                }
            }
            if (summaryStartIndex !== -1) {
                const extractedSummaryString = lines.slice(summaryStartIndex, summaryEndIndex === -1 ? lines.length : summaryEndIndex).join('\n').trim();
                const ansiRegex = /\u001b\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGKHF]/g;
                cleanedSummaryString = extractedSummaryString.replace(ansiRegex, '');
            }
            if (cleanedSummaryString) {
                try {
                    // Overwrite if exists
                    await fs.promises.writeFile(summaryFullOutputPath, cleanedSummaryString, 'utf-8');
                    summarySaved = true;
                } catch (writeErr: any) { console.warn("Failed to write summary file:", writeErr); }
            }
             if (fs.existsSync(finalMainFullOutputPath)) {
                 try { await fs.promises.unlink(finalMainFullOutputPath); } catch (unlinkErr: any) { console.warn("Failed to delete old main output file:", unlinkErr); }
             }
            await fs.promises.rename(tempFullOutputPath, finalMainFullOutputPath);
        } catch (processingError: any) {
             if (fs.existsSync(tempFullOutputPath)) {
                 try { await fs.promises.unlink(tempFullOutputPath); } catch (e) { /* ignore */ }
             }
            if (!res.headersSent) {
                 res.status(500).json({ success: false, error: `Failed during file processing: ${processingError.message}` });
            }
            return;
        }
        let successMessage = `Repomix completed. Main output saved as ${finalMainFilename}.`;
        if (summarySaved) successMessage += ` Cleaned summary saved as ${summaryFilename}.`;
        else if (cleanedSummaryString) successMessage += ` Failed to save summary.`;
        else successMessage += ` Pack summary block not found.`;

        if (!res.headersSent) {
             res.status(200).json({ success: true, message: successMessage, outputFilename: finalMainFilename });
         }
    });
});

export default router;