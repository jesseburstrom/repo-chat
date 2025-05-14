// gemini-repomix-ui/src/components/RepomixForm.tsx
import React, { useState } from 'react';

interface RepomixFormProps {
    onGenerate: (repoUrl: string, includePatterns: string, excludePatterns: string) => void;
    isGenerating: boolean;
    repoUrl: string; // ++ Receive repoUrl as a prop
    onRepoUrlChange: (url: string) => void; // ++ Receive handler to change repoUrl
}

const RepomixForm: React.FC<RepomixFormProps> = ({
    onGenerate,
    isGenerating,
    repoUrl, // ++ Use prop
    onRepoUrlChange, // ++ Use prop
}) => {
    // Removed internal formRepoUrl state
    const [includePatterns, setIncludePatterns] = useState('**/*.css,**/*.dart,**/*.ts,**/*.tsx,**/*.py,**/*.cs,**/*.go');
    const [excludePatterns, setExcludePatterns] = useState('*.log,tmp/');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (repoUrl.trim() && !isGenerating) { // ++ Use prop repoUrl
            onGenerate(repoUrl, includePatterns, excludePatterns); // ++ Use prop repoUrl
        }
    };

    return (
        <>
            <h3 className="mt-0 mb-[15px] text-[#333] font-medium text-lg">Generate Project Description</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
                <div className="flex flex-col gap-[4px]">
                    <label htmlFor="repoUrl" className="text-[0.9em] text-[#5f6368] font-medium">
                        GitHub Repo URL:
                    </label>
                    <input
                        type="url"
                        id="repoUrl"
                        value={repoUrl} // ++ Bind to prop
                        onChange={(e) => onRepoUrlChange(e.target.value)} // ++ Call prop handler
                        placeholder="https://github.com/user/repo.git"
                        required
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee] focus:outline-none focus:border-[#5dade2] focus:ring-2 focus:ring-[#5dade2]/20"
                    />
                </div>

                <div className="flex flex-col gap-[4px]">
                    <label htmlFor="includePatterns" className="text-[0.9em] text-[#5f6368] font-medium">
                        Include Patterns (comma-separated):
                    </label>
                    <input
                        type="text"
                        id="includePatterns"
                        value={includePatterns}
                        onChange={(e) => setIncludePatterns(e.target.value)}
                        placeholder="src/**/*.js,*.css"
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee] focus:outline-none focus:border-[#5dade2] focus:ring-2 focus:ring-[#5dade2]/20"
                    />
                </div>

                <div className="flex flex-col gap-[4px]">
                    <label htmlFor="excludePatterns" className="text-[0.9em] text-[#5f6368] font-medium">
                        Exclude Patterns (comma-separated):
                    </label>
                    <input
                        type="text"
                        id="excludePatterns"
                        value={excludePatterns}
                        onChange={(e) => setExcludePatterns(e.target.value)}
                        placeholder="*.log,dist/"
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee] focus:outline-none focus:border-[#5dade2] focus:ring-2 focus:ring-[#5dade2]/20"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isGenerating || !repoUrl.trim()} // ++ Use prop repoUrl for disabled check
                    className="self-start mt-2 bg-[#1a73e8] text-white rounded-[4px] px-[15px] py-[10px] cursor-pointer font-medium text-base transition-colors duration-200 ease-in-out hover:enabled:bg-[#185abc] disabled:bg-[#ccc] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isGenerating ? 'Generating...' : 'Generate Description File'}
                </button>
            </form>
        </>
    );
};

export default RepomixForm;