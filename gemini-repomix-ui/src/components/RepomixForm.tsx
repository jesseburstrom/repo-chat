// gemini-repomix-ui/src/components/RepomixForm.tsx
import React, { useState, FormEvent } from 'react'; // Removed useEffect as it's not used

interface RepomixFormProps {
    // onGenerate now matches the signature of handleGenerateAndSelect in ConfigurationPanel
    onGenerate: (repoUrl: string, includePatterns: string, excludePatterns: string) => Promise<void>;
    isGenerating: boolean;
    repoUrl: string; // This prop comes from repoUrlForForm in RepoFileManagerContext via ConfigurationPanel
    onRepoUrlChange: (url: string) => void; // This prop calls setRepoUrlForForm in RepoFileManagerContext via ConfigurationPanel
}

const RepomixForm: React.FC<RepomixFormProps> = ({
    onGenerate,
    isGenerating,
    repoUrl,
    onRepoUrlChange,
}) => {
    // Include/Exclude patterns are local to this form as they are specific to a single generation action.
    const [includePatterns, setIncludePatterns] = useState('**/*.css,**/*.dart,**/*.ts,**/*.tsx,**/*.py,**/*.cs,**/*.go');
    const [excludePatterns, setExcludePatterns] = useState('*.log,tmp/');

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (repoUrl.trim() && !isGenerating) {
            // No need to await here unless you want to do something after onGenerate finishes *within this component*
            // The parent (ConfigurationPanel) will handle the promise from generateRepomixOutput.
            onGenerate(repoUrl, includePatterns, excludePatterns);
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
                        value={repoUrl}
                        onChange={(e) => onRepoUrlChange(e.target.value)}
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
                    disabled={isGenerating || !repoUrl.trim()}
                    className="self-start mt-2 bg-[#1a73e8] text-white rounded-[4px] px-[15px] py-[10px] cursor-pointer font-medium text-base transition-colors duration-200 ease-in-out hover:enabled:bg-[#185abc] disabled:bg-[#ccc] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isGenerating ? 'Generating...' : 'Generate Description File'}
                </button>
            </form>
        </>
    );
};

export default RepomixForm;