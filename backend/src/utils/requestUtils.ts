// backend/src/utils/requestUtils.ts
export function generateSafeRepoPartsFromUrl(repoUrl: string): { success: boolean; safeUser?: string; safeRepo?: string; error?: string } {
    try {
        const url = new URL(repoUrl);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);

        if (pathParts.length < 2) {
            throw new Error('URL path does not contain user/org and repository name.');
        }
        const userOrOrg = pathParts[pathParts.length - 2];
        const repoName = pathParts[pathParts.length - 1].replace(/\.git$/, '');
        if (!userOrOrg || !repoName) {
             throw new Error('Could not extract user/org or repository name from URL path.');
        }
        const sanitize = (part: string) => part.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
        const safeUser = sanitize(userOrOrg);
        const safeRepo = sanitize(repoName);
        if (!safeUser || !safeRepo) {
            throw new Error('Sanitized user/org or repository name is empty.');
        }
        return { success: true, safeUser, safeRepo };
    } catch (error: any) {
        console.error("Error parsing URL or generating filename parts:", error);
        return { success: false, error: `Invalid repository URL format or content: ${error.message}` };
    }
}