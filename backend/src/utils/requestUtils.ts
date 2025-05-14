// backend/src/utils/requestUtils.ts

export interface ParsedRepoUrl {
    success: boolean;
    safeOwner?: string;        // Sanitized GitHub repository owner or organization
    safeRepoName?: string;     // Sanitized GitHub repository name
    safeBranch?: string;       // Sanitized branch name, if found in the URL
    rawOwner?: string;         // Raw owner from URL
    rawRepoName?: string;      // Raw repo name from URL
    rawBranch?: string;        // Raw branch name from URL, if found
    repoIdentifier: string;    // Sanitized identifier like "owner/repo"
    fullRepoIdentifierWithBranch?: string; // Sanitized identifier like "owner/repo/branch"
    error?: string;
}

export function parseGithubRepoUrl(repoUrl: string): ParsedRepoUrl {
    const defaultResult: Partial<ParsedRepoUrl> = { success: false, repoIdentifier: '' };

    try {
        const url = new URL(repoUrl);
        if (url.hostname.toLowerCase() !== 'github.com') {
            return { ...defaultResult, error: 'Invalid hostname. Only GitHub.com URLs are supported.' } as ParsedRepoUrl;
        }

        const pathParts = url.pathname.split('/').filter(part => part.length > 0 && part !== '.git');

        if (pathParts.length < 2) {
            return { ...defaultResult, error: 'URL path does not contain owner and repository name.' } as ParsedRepoUrl;
        }

        const rawOwner = pathParts[0];
        const rawRepoName = pathParts[1].replace(/\.git$/, ''); // Remove .git suffix if present
        let rawBranch: string | undefined = undefined;

        // Check for branch in path (e.g., /tree/branch_name or /blob/branch_name)
        // GitHub URLs can also be just /owner/repo/ (implies default branch)
        // or /owner/repo/tree/branchname or /owner/repo/blob/branchname/filepath
        if (pathParts.length >= 4 && (pathParts[2].toLowerCase() === 'tree' || pathParts[2].toLowerCase() === 'blob')) {
            rawBranch = pathParts[3];
        } else if (pathParts.length === 3 && (pathParts[2].toLowerCase() === 'tree' || pathParts[2].toLowerCase() === 'blob')){
            // This case might indicate an invalid URL like /owner/repo/tree (missing branch)
            // For now, we assume if 'tree' or 'blob' is the 3rd part, a 4th part is expected for branch.
            // Or, if Repomix handles the default branch well, we might not need to parse it explicitly here
            // unless the user provides a specific branch URL.
            // If Repomix only gets https://github.com/owner/repo, it clones default.
            // If it gets https://github.com/owner/repo/tree/mybranch, we want "mybranch".
        }


        if (!rawOwner || !rawRepoName) {
            return { ...defaultResult, error: 'Could not extract owner or repository name from URL path.' } as ParsedRepoUrl;
        }

        // Sanitize parts for use in filenames or paths
        // Allows alphanumeric, hyphen, underscore, dot. Replaces others with underscore.
        const sanitize = (part: string | undefined): string | undefined => {
            if (part === undefined) return undefined;
            return part.replace(/[^a-zA-Z0-9\-._]/g, '_').replace(/_+/g, '_');
        };

        const safeOwner = sanitize(rawOwner);
        const safeRepoName = sanitize(rawRepoName);
        const safeBranch = sanitize(rawBranch);

        if (!safeOwner || !safeRepoName) {
            return { ...defaultResult, error: 'Sanitized owner or repository name is empty.' } as ParsedRepoUrl;
        }

        const repoIdentifier = `${safeOwner}/${safeRepoName}`;
        const fullRepoIdentifierWithBranch = safeBranch ? `${repoIdentifier}/${safeBranch}` : repoIdentifier;

        return {
            success: true,
            safeOwner,
            safeRepoName,
            safeBranch,
            rawOwner,
            rawRepoName,
            rawBranch,
            repoIdentifier,
            fullRepoIdentifierWithBranch,
        };

    } catch (error: any) {
        console.error("Error parsing GitHub URL:", error);
        return { ...defaultResult, error: `Invalid repository URL format or content: ${error.message}` } as ParsedRepoUrl;
    }
}