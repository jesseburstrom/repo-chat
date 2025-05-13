// src/RepoSelector.tsx
import React from 'react';
// Removed: import './RepoSelector.css'; // Migrated to Tailwind

export interface RepoInfo {
    filename: string;
    repoIdentifier: string;
}

interface RepoSelectorProps {
    repos: RepoInfo[];
    onSelectRepo: (selectedFilename: string) => void; // Callback with filename
    isLoading: boolean;
    disabled?: boolean; // Allow disabling from parent
    selectedValue: string; // Control selected value from parent
}

const RepoSelector: React.FC<RepoSelectorProps> = ({
    repos,
    onSelectRepo,
    isLoading,
    disabled = false,
    selectedValue,
}) => {

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onSelectRepo(event.target.value);
    };

    return (
        // .repo-selector-container
        <div className="px-[25px] py-[15px] border-b border-[#e0e0e0] bg-[#f8f9fa] flex items-center gap-[10px]">
            {/* .repo-selector-container label */}
            <label htmlFor="repoSelect" className="text-[0.9em] text-[#5f6368] font-medium whitespace-nowrap">
                Load Generated Description:
            </label>
            {/* .repo-selector-container select */}
            <select
                id="repoSelect"
                value={selectedValue} // Controlled component
                onChange={handleChange}
                disabled={isLoading || disabled || repos.length === 0}
                className="flex-grow px-[10px] py-[8px] border border-[#ccc] rounded-[4px] text-base bg-white cursor-pointer disabled:bg-[#eee] disabled:cursor-not-allowed disabled:opacity-70"
            >
                <option value="" disabled={isLoading}>
                    {isLoading ? 'Loading repos...' : (repos.length === 0 ? 'No descriptions found' : '-- Select a Repo --')}
                </option>
                {repos.map((repo) => (
                    <option key={repo.filename} value={repo.filename}>
                        {repo.repoIdentifier} ({repo.filename.substring(0,20)}...)
                    </option>
                ))}
            </select>
        </div>
    );
};

export default RepoSelector;