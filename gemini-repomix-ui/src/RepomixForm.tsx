// src/RepomixForm.tsx
import React, { useState } from 'react';
// Removed: import './RepomixForm.css'; // Migrated to Tailwind

interface RepomixFormProps {
    repoUrl: string;
    onRepoUrlChange: (value: string) => void;
    onGenerate: (repoUrl: string, includePatterns: string, excludePatterns: string) => void;
    isGenerating: boolean;
    generationMessage: string | null;
    generationError: string | null;
}

const RepomixForm: React.FC<RepomixFormProps> = ({
    repoUrl,
    onRepoUrlChange,
    onGenerate,
    isGenerating,
    generationMessage,
    generationError,
}) => {
    const [includePatterns, setIncludePatterns] = useState('**/*.css,**/*.dart,**/*.ts,**/*.tsx,**/*.py,**/*.cs,**/*.go');
    const [excludePatterns, setExcludePatterns] = useState('*.log,tmp/');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (repoUrl && !isGenerating) {
            onGenerate(repoUrl, includePatterns, excludePatterns);
        }
    };

    // Base classes for status messages
    const statusBaseClasses = "mt-[10px] p-[8px] rounded-[4px] text-[0.9em]";
    const successClasses = "bg-[#e6f4ea] text-[#137333] border border-[#a8d1b4]";
    const errorClasses = "bg-[#fce8e6] text-[#c5221f] border border-[#f4aca9]";

    return (
        // .repomix-form-container
        <div className="px-[25px] py-[15px] border-b border-[#e0e0e0] bg-[#f8f9fa]">
            {/* .repomix-form-container h3 */}
            <h3 className="mt-0 mb-[15px] text-[#333] font-medium">Generate Project Description</h3>
            {/* .repomix-form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
                {/* .form-group */}
                <div className="flex flex-col gap-[4px]">
                    {/* .form-group label */}
                    <label htmlFor="repoUrl" className="text-[0.9em] text-[#5f6368] font-medium">
                        GitHub Repo URL:
                    </label>
                    {/* .form-group input[type="url"] */}
                    <input
                        type="url"
                        id="repoUrl"
                        value={repoUrl}
                        onChange={(e) => onRepoUrlChange(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        required
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee]"
                    />
                </div>
                {/* .form-group */}
                <div className="flex flex-col gap-[4px]">
                    {/* .form-group label */}
                    <label htmlFor="includePatterns" className="text-[0.9em] text-[#5f6368] font-medium">
                        Include Patterns (comma-separated):
                    </label>
                    {/* .form-group input[type="text"] */}
                    <input
                        type="text"
                        id="includePatterns"
                        value={includePatterns}
                        onChange={(e) => setIncludePatterns(e.target.value)}
                        placeholder="src/**/*.js,*.css"
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee]"
                    />
                </div>
                {/* .form-group */}
                <div className="flex flex-col gap-[4px]">
                    {/* .form-group label */}
                    <label htmlFor="excludePatterns" className="text-[0.9em] text-[#5f6368] font-medium">
                        Exclude Patterns (comma-separated):
                    </label>
                     {/* .form-group input[type="text"] */}
                    <input
                        type="text"
                        id="excludePatterns"
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        placeholder="*.log,dist/"
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee]"
                    />
                </div>
                {/* .repomix-form button */}
                <button
                    type="submit"
                    disabled={isGenerating || !repoUrl}
                    className="self-start bg-[#1a73e8] text-white rounded-[4px] px-[15px] py-[10px] cursor-pointer font-medium text-base transition-colors duration-200 ease-in-out hover:enabled:bg-[#185abc] disabled:bg-[#ccc] disabled:cursor-not-allowed"
                >
                    {isGenerating ? 'Generating...' : 'Generate Description File'}
                </button>
            </form>
            {/* .generation-status */}
            {generationMessage && (
                <p className={`${statusBaseClasses} ${successClasses}`}>
                    {generationMessage}
                </p>
            )}
            {generationError && (
                <p className={`${statusBaseClasses} ${errorClasses}`}>
                    Error: {generationError}
                </p>
            )}
        </div>
    );
};

export default RepomixForm;