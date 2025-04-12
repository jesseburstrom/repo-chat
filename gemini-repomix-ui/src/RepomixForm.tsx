// src/RepomixForm.tsx
import React, { useState } from 'react';
import './RepomixForm.css'; // We'll create this CSS file

interface RepomixFormProps {
    onGenerate: (repoUrl: string, includePatterns: string, excludePatterns: string) => void;
    isGenerating: boolean;
    generationMessage: string | null;
    generationError: string | null;
}

const RepomixForm: React.FC<RepomixFormProps> = ({
    onGenerate,
    isGenerating,
    generationMessage,
    generationError,
}) => {
    const [repoUrl, setRepoUrl] = useState('');
    // Default values similar to your python example
    const [includePatterns, setIncludePatterns] = useState('lib/**/*.dart,backend/**/*.ts,unity/**/*.cs');
    const [excludePatterns, setExcludePatterns] = useState('*.log,tmp/'); // repomix uses --ignore

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (repoUrl && !isGenerating) {
            onGenerate(repoUrl, includePatterns, excludePatterns);
        }
    };

    return (
        <div className="repomix-form-container">
            <h3>Generate Project Description</h3>
            <form onSubmit={handleSubmit} className="repomix-form">
                <div className="form-group">
                    <label htmlFor="repoUrl">GitHub Repo URL:</label>
                    <input
                        type="url"
                        id="repoUrl"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        required
                        disabled={isGenerating}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="includePatterns">Include Patterns (comma-separated):</label>
                    <input
                        type="text"
                        id="includePatterns"
                        value={includePatterns}
                        onChange={(e) => setIncludePatterns(e.target.value)}
                        placeholder="src/**/*.js,*.css"
                        disabled={isGenerating}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="excludePatterns">Exclude Patterns (comma-separated):</label>
                    <input
                        type="text"
                        id="excludePatterns"
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        placeholder="*.log,dist/"
                        disabled={isGenerating}
                    />
                </div>
                <button type="submit" disabled={isGenerating || !repoUrl}>
                    {isGenerating ? 'Generating...' : 'Generate Description File'}
                </button>
            </form>
            {generationMessage && <p className="generation-status success">{generationMessage}</p>}
            {generationError && <p className="generation-status error">Error: {generationError}</p>}
        </div>
    );
};

export default RepomixForm;