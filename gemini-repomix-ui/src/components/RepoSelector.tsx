// gemini-repomix-ui/src/components/RepoSelector.tsx
import React, { ChangeEvent } from 'react'; // Added ChangeEvent

export interface RepoInfo {
    filename: string;
    repoIdentifier: string; // e.g., "owner/repo" or "owner/repo/branch_mybranch"
}

interface RepoSelectorProps {
    repos: RepoInfo[];
    // onSelectRepo now matches the signature of selectRepoFileForProcessing in RepoFileManagerContext
    onSelectRepo: (selectedFilename: string | null) => void;
    isLoading: boolean; // isLoadingRepoFiles from RepoFileManagerContext
    disabled?: boolean; // General disable flag, if needed from parent
    selectedValue: string; // selectedRepoFilename from RepoFileManagerContext (will be filename or empty string)
    // onDeleteRepo now matches the signature of deleteRepoFile from RepoFileManagerContext (or its wrapper)
    onDeleteRepo?: (filename: string) => Promise<boolean>;
    isDeleting?: boolean; // isDeleting from RepoFileManagerContext
}

const RepoSelector: React.FC<RepoSelectorProps> = ({
    repos,
    onSelectRepo,
    isLoading,
    disabled = false,
    selectedValue,
    onDeleteRepo,
    isDeleting,
}) => {

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        onSelectRepo(value === "" ? null : value); // Pass null if "Select a Repo" is chosen
    };

    const handleDeleteClick = () => {
        if (selectedValue && onDeleteRepo && !isDeleting) {
            if (window.confirm(`Are you sure you want to delete ${selectedValue}? This action cannot be undone.`)) {
                onDeleteRepo(selectedValue);
                // The parent (ConfigurationPanel/RepoFileManagerContext) will handle state updates
                // like clearing selectedValue if the deleted item was the selected one.
            }
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-[10px]">
                <label htmlFor="repoSelect" className="text-[0.9em] text-[#5f6368] font-medium whitespace-nowrap">
                    Load Generated Description:
                </label>
                <select
                    id="repoSelect"
                    value={selectedValue} // selectedValue is the filename or ""
                    onChange={handleChange}
                    disabled={isLoading || disabled || repos.length === 0}
                    className="flex-grow px-[10px] py-[8px] border border-[#ccc] rounded-[4px] text-base bg-white cursor-pointer disabled:bg-[#eee] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <option value=""> {/* Ensure value is empty string for the placeholder */}
                        {isLoading ? 'Loading repos...' : (repos.length === 0 ? 'No descriptions found' : '-- Select a Repo --')}
                    </option>
                    {repos.map((repo) => (
                        <option key={repo.filename} value={repo.filename}>
                            {/* Displaying repoIdentifier (e.g., user/repo) and a truncated filename */}
                            {repo.repoIdentifier} ({repo.filename.substring(0, repo.filename.lastIndexOf('_') > 8 ? repo.filename.lastIndexOf('_', repo.filename.lastIndexOf('_')-1) : 20)}...)
                        </option>
                    ))}
                </select>
            </div>
            {selectedValue && onDeleteRepo && (
                <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting || isLoading || !selectedValue} // isLoading here could be isLoadingRepoFiles
                    className="self-start mt-1 px-3 py-1 text-xs text-red-700 bg-red-100 border border-red-300 rounded hover:bg-red-200 disabled:opacity-50"
                    title={`Delete ${selectedValue}`}
                >
                    {isDeleting ? 'Deleting...' : 'Delete Selected File'}
                </button>
            )}
        </div>
    );
};

export default RepoSelector;