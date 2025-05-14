// backend/src/routes/repomixRoutes.ts
import express, { Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import {
    supabaseAdminClient,
    GENERATED_FILES_DIR,
    TEMP_FILENAME_PREFIX,
    MAIN_FILENAME_EXTENSION,
    SUMMARY_FILENAME_SUFFIX,
    SUMMARY_FILENAME_EXTENSION,
} from '../config/appConfig';
import { parseGithubRepoUrl } from '../utils/requestUtils'; // Use the new parsing function
import { addUserGeneratedFile } from '../services/repomixService';

const router = express.Router();

interface RunRepomixRequestBody {
    repoUrl: string;
    includePatterns?: string;
    excludePatterns?: string;
}

interface RunRepomixSuccessData {
    newFile: { filename: string; repoIdentifier: string };
    message: string;
}

interface RunRepomixFullResponse {
    success: boolean;
    data?: RunRepomixSuccessData;
    error?: string;
    stderr?: string;
    stdout?: string;
}

router.post('/run-repomix', async (req: AuthenticatedRequest, res: Response<RunRepomixFullResponse>, next: NextFunction) => {
    const { repoUrl, includePatterns, excludePatterns } = req.body as RunRepomixRequestBody;
    const appUserId = req.user?.id;

    if (!appUserId || !supabaseAdminClient) {
        res.status(403).json({ success: false, error: 'User not authenticated or server misconfigured.' });
        return;
    }
    if (!repoUrl) {
        res.status(400).json({ success: false, error: 'repoUrl is required' });
        return;
    }

    const repoParts = parseGithubRepoUrl(repoUrl);

    if (!repoParts.success || !repoParts.safeOwner || !repoParts.safeRepoName) {
        res.status(400).json({ success: false, error: repoParts.error || 'Failed to parse repository URL parts.' });
        return;
    }

    const { safeOwner, safeRepoName, safeBranch, rawBranch, rawOwner, rawRepoName, fullRepoIdentifierWithBranch } = repoParts;

    // Construct a unique base filename
    const appUserPrefix = appUserId.substring(0, 8); // Use a part of the app user's ID for namespacing
    let baseFilenameElements = [appUserPrefix, safeOwner, safeRepoName];
    if (safeBranch) {
        baseFilenameElements.push('branch', safeBranch);
    }
    const uniqueBaseFilename = baseFilenameElements.join('_');

    const finalMainFilename = `${uniqueBaseFilename}${MAIN_FILENAME_EXTENSION}`;
    const summaryFilename = `${uniqueBaseFilename}${SUMMARY_FILENAME_SUFFIX}${SUMMARY_FILENAME_EXTENSION}`;
    const tempOutputFilename = `${TEMP_FILENAME_PREFIX}_${uniqueBaseFilename}_${Date.now()}${MAIN_FILENAME_EXTENSION}`;

    const tempFullOutputPath = path.join(GENERATED_FILES_DIR, tempOutputFilename);
    const finalMainFullOutputPath = path.join(GENERATED_FILES_DIR, finalMainFilename);
    const summaryFullOutputPath = path.join(GENERATED_FILES_DIR, summaryFilename);

    const repomixExecutable = "npx repomix"; // Consider making this configurable

    // Prepare the remote URL for Repomix.
    // If a specific branch was parsed, construct the URL to clone that branch directly.
    // Otherwise, use the original URL (Repomix will clone the default branch).
    // Most Git servers support cloning a specific branch via <repo_url>#<branch_name>
    // or by simply cloning the repo and then checking out the branch.
    // For Repomix, it's usually best to provide a URL that directly points to the desired state if possible,
    // or ensure Repomix itself handles the branch selection.
    // The current parseGithubRepoUrl might give a URL like "https://github.com/owner/repo/tree/branch"
    // Repomix might handle this, or it might need "https://github.com/owner/repo.git" and a separate branch flag.
    // Let's assume for now Repomix handles the full URL with /tree/branch if provided.
    // If Repomix needs `git@github.com:owner/repo.git` format or explicit branch flag, adjust here.
    let repomixRemoteArg = repoUrl; // Default to user-provided URL
    // If we parsed a rawBranch, it implies the user wants that specific branch.
    // We need to ensure Repomix will use it.
    // A simple way for Repomix (if it just uses git clone) is often to target the repo and specify branch.
    // However, Repomix's `--remote` might be smart enough.
    // If not, you'd construct command like:
    // `git clone --branch ${rawBranch} https://github.com/${rawOwner}/${rawRepoName}.git temp_dir && npx repomix --local temp_dir ...`
    // This is more complex. For now, we'll pass the original URL and hope Repomix is smart or uses default.
    // If a branch is critical, this part needs verification against Repomix's capabilities.
    // The simplest for Repomix `--remote` is often just `https://github.com/user/repo.git`.
    // If user provides `.../tree/my-branch`, `repoUrl` itself might work.
    // If user provides `.../tree/my-branch` AND Repomix needs `--branch my-branch` AND `--remote https://github.com/user/repo.git`:

    let baseRepoGitUrl = `https://github.com/${rawOwner}/${rawRepoName}.git`;
    let command = `${repomixExecutable} --remote "${baseRepoGitUrl}" --output "${tempFullOutputPath}" --style xml`;
    
    if (includePatterns) command += ` --include "${includePatterns}"`;
    if (excludePatterns) command += ` --ignore "${excludePatterns}"`;


    if (fs.existsSync(tempFullOutputPath)) {
        try { fs.unlinkSync(tempFullOutputPath); } catch (e) { console.warn("Could not delete pre-existing temp file:", e); }
    }

    console.log(`Executing Repomix for user ${appUserId}, repo: ${fullRepoIdentifierWithBranch}: ${command}`);

    const execPromise = new Promise<{ stdout: string, stderr: string, success: boolean, error?: Error }>((resolve) => {
        exec(command, { timeout: 300000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => { // Increased maxBuffer
            if (error) {
                resolve({ stdout, stderr, success: false, error });
                return;
            }
            resolve({ stdout, stderr, success: true });
        });
    });

    try {
        const { stdout, stderr, success: execSuccess, error: execError } = await execPromise;

        if (!execSuccess || execError) {
            if (fs.existsSync(tempFullOutputPath)) {
                try { fs.unlinkSync(tempFullOutputPath); } catch (e) { /* ignore */ }
            }
            if (!res.headersSent) {
                 res.status(500).json({ success: false, error: `Repomix execution failed: ${execError?.message}`, stderr: stderr, stdout: stdout });
            }
            return;
        }

        if (stderr) console.warn(`Repomix stderr output (user ${appUserId}, repo: ${fullRepoIdentifierWithBranch}):\n${stderr}`);

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
            let summaryStartIndex = -1, summaryEndIndex = -1;
            const startMarker = 'pack summary', endMarker = '🎉 all done!';
            for (let i = 0; i < lines.length; i++) {
                const lineLower = lines[i].toLowerCase();
                if (summaryStartIndex === -1 && lineLower.includes(startMarker)) summaryStartIndex = i;
                if (summaryStartIndex !== -1 && lineLower.includes(endMarker) && i > summaryStartIndex) {
                    summaryEndIndex = i; break;
                }
            }
            if (summaryStartIndex !== -1) {
                const extractedSummary = lines.slice(summaryStartIndex, summaryEndIndex === -1 ? lines.length : summaryEndIndex).join('\n').trim();
                const ansiRegex = /\u001b\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGKHF]/g;
                cleanedSummaryString = extractedSummary.replace(ansiRegex, '');
            }
            if (cleanedSummaryString) {
                try {
                    await fs.promises.writeFile(summaryFullOutputPath, cleanedSummaryString, 'utf-8');
                    summarySaved = true;
                } catch (writeErr: any) { console.warn(`Failed to write summary file for user ${appUserId}:`, writeErr); }
            }
            if (fs.existsSync(finalMainFullOutputPath)) {
                try { await fs.promises.unlink(finalMainFullOutputPath); } catch (unlinkErr: any) { console.warn(`Failed to delete old main output:`, unlinkErr); }
            }
            await fs.promises.rename(tempFullOutputPath, finalMainFullOutputPath);
        } catch (fileProcessingError: any) {
            if (fs.existsSync(tempFullOutputPath)) {
                try { await fs.promises.unlink(tempFullOutputPath); } catch (e) { /* ignore */ }
            }
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: `Failed during file processing: ${fileProcessingError.message}` });
            }
            return;
        }

        const repoIdForDB = fullRepoIdentifierWithBranch || `${safeOwner}/${safeRepoName}`; // Use the most specific identifier
        const dbResult = await addUserGeneratedFile(appUserId, finalMainFilename, repoIdForDB, supabaseAdminClient);

        let successMessage = `Repomix completed for ${repoIdForDB}. Output: ${finalMainFilename}.`;
        if (summarySaved) successMessage += ` Summary saved.`;
        else if (cleanedSummaryString) successMessage += ` Failed to save summary.`;
        else successMessage += ` Pack summary not found.`;

        if (!dbResult.success || !dbResult.data) {
            console.error(`File ${finalMainFilename} (user ${appUserId}) created but DB record failed: ${dbResult.error}`);
            successMessage += ` WARNING: DB record failed: ${dbResult.error}.`;
            if (!res.headersSent) {
                res.status(207).json({
                    success: true,
                    data: {
                        newFile: { filename: finalMainFilename, repoIdentifier: repoIdForDB },
                        message: successMessage,
                    },
                    error: `Database record failed: ${dbResult.error}`
                });
            }
            return;
        }

        if (!res.headersSent) {
            res.status(200).json({
                success: true,
                data: {
                    newFile: { filename: dbResult.data.filename, repoIdentifier: dbResult.data.repo_identifier },
                    message: successMessage,
                }
            });
        }

    } catch (error: any) {
        console.error(`Unhandled error in /run-repomix for user ${appUserId}, repo ${fullRepoIdentifierWithBranch}:`, error);
        if (fs.existsSync(tempFullOutputPath)) {
            try { await fs.promises.unlink(tempFullOutputPath); } catch (e) { /* ignore */ }
        }
        if (!res.headersSent) {
           next(error);
        }
    }
});

export default router;