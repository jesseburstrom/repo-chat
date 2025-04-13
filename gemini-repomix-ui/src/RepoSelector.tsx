// src/RepoSelector.tsx
import React from 'react';
import './RepoSelector.css'; // Create this file

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
        <div className="repo-selector-container">
            <label htmlFor="repoSelect">Load Generated Description:</label>
            <select
                id="repoSelect"
                value={selectedValue} // Controlled component
                onChange={handleChange}
                disabled={isLoading || disabled || repos.length === 0}
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