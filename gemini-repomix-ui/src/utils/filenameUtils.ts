// Create: gemini-repomix-ui/src/utils/filenameUtils.ts
export function parseRepoInfoFromFilename(filenameWithExtension: string): { owner: string; repoName: string } | null {
    if (!filenameWithExtension || !filenameWithExtension.includes('_')) {
        return null;
    }

    // Remove .md extension if present
    const filename = filenameWithExtension.endsWith('.md')
        ? filenameWithExtension.slice(0, -3)
        : filenameWithExtension;

    const parts = filename.split('_');

    // Example formats:
    // useridpfx_owner_repo.md  -> parts = [useridpfx, owner, repo] (length 3)
    // useridpfx_owner_repo_branch_mybranch.md -> parts = [useridpfx, owner, repo, branch, mybranch] (length 5)
    // We need at least 3 parts for appUserPrefix, owner, and repoName.
    if (parts.length < 3) {
        return null;
    }

    // parts[0] is appUserPrefix (e.g., 8 characters)
    const owner = parts[1];
    const repoName = parts[2];

    if (!owner || !repoName) {
        return null;
    }

    return { owner, repoName };
}