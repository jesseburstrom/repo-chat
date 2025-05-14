// src/components/RepoSelector.tsx
import React from 'react';

export interface RepoInfo {
    filename: string;
    repoIdentifier: string;
}

interface RepoSelectorProps {
    repos: RepoInfo[];
    onSelectRepo: (selectedFilename: string) => void;
    isLoading: boolean;
    disabled?: boolean;
    selectedValue: string;
    onDeleteRepo?: (filename: string) => void; // New optional prop for delete callback
    isDeleting?: boolean; // Optional: to disable delete button during its own loading
}

const RepoSelector: React.FC<RepoSelectorProps> = ({
    repos,
    onSelectRepo,
    isLoading,
    disabled = false,
    selectedValue,
    onDeleteRepo, // Destructure new prop
    isDeleting,   // Destructure new prop
}) => {

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onSelectRepo(event.target.value);
    };

    const handleDeleteClick = () => {
        if (selectedValue && onDeleteRepo && !isDeleting) {
            if (window.confirm(`Are you sure you want to delete ${selectedValue}? This action cannot be undone.`)) {
                onDeleteRepo(selectedValue);
            }
        }
    };

    return (
        <div className="flex flex-col gap-2"> {/* Changed to flex-col for button placement */}
            <div className="flex items-center gap-[10px]">
                <label htmlFor="repoSelect" className="text-[0.9em] text-[#5f6368] font-medium whitespace-nowrap">
                    Load Generated Description:
                </label>
                <select
                    id="repoSelect"
                    value={selectedValue}
                    onChange={handleChange}
                    disabled={isLoading || disabled || repos.length === 0}
                    className="flex-grow px-[10px] py-[8px] border border-[#ccc] rounded-[4px] text-base bg-white cursor-pointer disabled:bg-[#eee] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <option value="" disabled={isLoading || repos.length === 0}>
                        {isLoading ? 'Loading repos...' : (repos.length === 0 ? 'No descriptions found' : '-- Select a Repo --')}
                    </option>
                    {repos.map((repo) => (
                        <option key={repo.filename} value={repo.filename}>
                            {repo.repoIdentifier} ({repo.filename.substring(0, Math.min(20, repo.filename.length - 3))}...)
                        </option>
                    ))}
                </select>
            </div>
            {selectedValue && onDeleteRepo && (
                <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting || isLoading || !selectedValue}
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