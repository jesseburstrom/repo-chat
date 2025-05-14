// src/RepomixForm.tsx
import React, { useState } from 'react';

interface RepomixFormProps {
    // This function is ultimately provided by RepomixContext, passed through App.tsx
    onGenerate: (repoUrl: string, includePatterns: string, excludePatterns: string) => void;
    // This state is also from RepomixContext, passed through App.tsx
    isGenerating: boolean;
    // repoUrl, onRepoUrlChange, generationMessage, generationError are no longer passed as props
}

const RepomixForm: React.FC<RepomixFormProps> = ({
    onGenerate,
    isGenerating,
}) => {
    // Internal state for the form inputs
    const [formRepoUrl, setFormRepoUrl] = useState('');
    const [includePatterns, setIncludePatterns] = useState('**/*.css,**/*.dart,**/*.ts,**/*.tsx,**/*.py,**/*.cs,**/*.go');
    const [excludePatterns, setExcludePatterns] = useState('*.log,tmp/');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (formRepoUrl.trim() && !isGenerating) {
            onGenerate(formRepoUrl, includePatterns, excludePatterns);
        }
    };

    // Tailwind classes are defined in App.tsx's controlPanelBaseClasses or locally if specific
    // For simplicity, assuming App.tsx styles the container of this form.

    return (
        // The outer div with padding/border is likely handled by controlPanelBaseClasses in App.tsx
        // This component now focuses on the form itself.
        <>
            <h3 className="mt-0 mb-[15px] text-[#333] font-medium text-lg">Generate Project Description</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
                {/* Repo URL Input Group */}
                <div className="flex flex-col gap-[4px]">
                    <label htmlFor="repoUrl" className="text-[0.9em] text-[#5f6368] font-medium">
                        GitHub Repo URL:
                    </label>
                    <input
                        type="url"
                        id="repoUrl"
                        value={formRepoUrl}
                        onChange={(e) => setFormRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        required
                        disabled={isGenerating}
                        className="px-[10px] py-[8px] border border-[#dadce0] rounded-[4px] text-base disabled:bg-[#eee] focus:outline-none focus:border-[#5dade2] focus:ring-2 focus:ring-[#5dade2]/20"
                    />
                </div>

                {/* Include Patterns Input Group */}
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

                {/* Exclude Patterns Input Group */}
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

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isGenerating || !formRepoUrl.trim()}
                    className="self-start mt-2 bg-[#1a73e8] text-white rounded-[4px] px-[15px] py-[10px] cursor-pointer font-medium text-base transition-colors duration-200 ease-in-out hover:enabled:bg-[#185abc] disabled:bg-[#ccc] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isGenerating ? 'Generating...' : 'Generate Description File'}
                </button>
            </form>
            {/*
              generationMessage and generationError are no longer displayed here.
              They are handled by `attachmentStatus` and `error` from `RepomixContext`
              and displayed in App.tsx or a similar higher-level component.
            */}
        </>
    );
};

export default RepomixForm;