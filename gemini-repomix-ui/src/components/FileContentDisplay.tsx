// FilePath: gemini-repomix-ui/src/components/FileContentDisplay.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';

// --- Reusable Shikiji Hook ---
const useShikijiHighlighterInstance = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  useEffect(() => {
    let isMounted = true;
    getHighlighter({ themes: ['material-theme-lighter'], langs: Object.keys(bundledLanguages) })
      .then(hl => { if (isMounted) setHighlighter(hl); })
      .catch(err => console.error('Shikiji init error in FCD:', err));
    return () => { isMounted = false; };
  }, []);
  return highlighter;
};

// --- Helper Function to Guess Language ---
const getLanguageFromPath = (filePath: string | null): string => {
    if (!filePath) return 'plaintext';
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'ts': case 'tsx': return 'typescript';
        case 'js': case 'jsx': return 'javascript';
        case 'css': return 'css';
        case 'py': return 'python';
        case 'md': return 'markdown';
        case 'json': return 'json';
        case 'html': return 'html';
        case 'go': return 'go';
        case 'cs': return 'csharp';
        default: return 'plaintext';
    }
};

// --- Data structure for comparison view ---
interface ComparisonViewData {
    filePath: string;
    originalContent: string;
    suggestedContent: string;
}

// --- Props for the main component ---
interface FileContentDisplayProps {
    filePath: string | null;
    content: string | null;
    isLoading: boolean;
    comparisonData: ComparisonViewData | null;
    onCloseComparison?: () => void;
}

// Base Tailwind classes for the content area to be reused
const placeholderClasses = "text-gray-500 italic text-center pt-[30px] font-sans";

// ++ MODIFIED: Added min-h-0 to allow the flex item to shrink correctly and enable scrolling ++
const contentAreaClasses = "flex-grow overflow-y-auto overflow-x-auto font-mono text-sm leading-snug min-h-0";


// --- CodePane Sub-Component ---
const CodePane: React.FC<{ content: string; language: string; highlighter: Highlighter | null; title: string }> =
  React.memo(({ content, language, highlighter, title }) => {
    const [html, setHtml] = useState<string | null>(null);
    const [isHighlighting, setIsHighlighting] = useState(false);

    useEffect(() => {
        let isActive = true;
        const highlightContent = async () => {
            const normalizedContent = typeof content === 'string'
                ? content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                : '';

            if (!highlighter) {
                const safeContent = normalizedContent
                    .replace(/&/g, "&")
                    .replace(/</g, "<")
                    .replace(/>/g, ">");
                if (isActive) {
                    setHtml(`<pre class="m-0 whitespace-pre-wrap break-words p-[5px] bg-[#f8f8f8]"><code class="block">${safeContent || ''}</code></pre>`);
                    setIsHighlighting(false);
                }
                return;
            }

            if (isActive) setIsHighlighting(true);

            try {
                const resultHtml: string = await highlighter.codeToHtml(normalizedContent, { lang: language, theme: 'material-theme-lighter' });
                if (isActive) {
                    setHtml(resultHtml);
                }
            } catch (err: any) {
                console.warn(`Highlighting error for ${title} (lang: ${language}):`, err);
                const safeContent = normalizedContent
                    .replace(/&/g, "&")
                    .replace(/</g, "<")
                    .replace(/>/g, ">");
                if (isActive) {
                     setHtml(`<pre class="m-0 whitespace-pre-wrap break-words p-[5px] bg-[#f8f8f8]"><code class="block">${safeContent}</code></pre>`);
                }
            } finally {
                if (isActive) {
                    setIsHighlighting(false);
                }
            }
        };
        highlightContent();
        return () => { isActive = false; };
    }, [content, language, highlighter, title]);

    if (isHighlighting && !html) return <div className={placeholderClasses}>Highlighting {title}...</div>;

    if (!html) {
        const normalizedContent = typeof content === 'string'
            ? content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            : '';
        const safeContent = normalizedContent
            .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">");
        return <pre className="m-0 whitespace-pre-wrap break-words p-[5px] bg-[#f8f8f8]"><code className="block">{safeContent}</code></pre>;
    }
    
    // This div itself should naturally size to its content (the <pre> tag from Shikiji)
    // The parent (with contentAreaClasses) is responsible for scrolling.
    return <div className="font-mono text-sm leading-snug" dangerouslySetInnerHTML={{ __html: html }} />;
});
// --- End CodePane Sub-Component ---


// --- Main FileContentDisplay Component (with Tailwind) ---
const FileContentDisplay: React.FC<FileContentDisplayProps> = ({
    filePath,
    content,
    isLoading,
    comparisonData,
    onCloseComparison,
}) => {
    const highlighter = useShikijiHighlighterInstance();

    const singleFileLanguage = useMemo(() => getLanguageFromPath(filePath), [filePath]);
    const comparisonOriginalLanguage = useMemo(() => getLanguageFromPath(comparisonData?.filePath || null), [comparisonData?.filePath]);
    const comparisonSuggestedLanguage = comparisonOriginalLanguage;

    const panelBaseClasses = "p-2.5 bg-white border-l border-gray-300 overflow-hidden h-full flex-shrink-0 flex flex-col";
    const h4BaseClasses = "mt-0 mb-2.5 text-[0.95em] text-gray-700 font-medium border-b border-gray-200 pb-[5px] whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0";

    if (comparisonData) {
        return (
            <div className={`${panelBaseClasses}`}>
                <div className="flex justify-between items-center flex-shrink-0">
                    <h4 className={`${h4BaseClasses} border-b-0 mb-0`}>
                        Comparing: {comparisonData.filePath}
                    </h4>
                    {onCloseComparison && (
                        <button
                            onClick={onCloseComparison}
                            className="px-2.5 py-1 text-sm bg-gray-300 border border-gray-400 rounded cursor-pointer hover:bg-gray-400"
                        >
                            Close Comparison
                        </button>
                    )}
                </div>
                <div className="flex flex-row flex-grow overflow-hidden gap-2.5 border-t border-gray-200 pt-2.5 min-h-0"> {/* Added min-h-0 here too for the flex-row container */}
                    <div className="flex-1 flex flex-col overflow-hidden border border-gray-100 rounded">
                        <h5 className="m-0 px-2 py-[5px] bg-gray-50 text-sm font-medium border-b border-gray-300 flex-shrink-0">
                            Original
                        </h5>
                        <div className={`${contentAreaClasses} bg-gray-50`}> {/* contentAreaClasses already has min-h-0 */}
                            <CodePane title="Original" content={comparisonData.originalContent} language={comparisonOriginalLanguage} highlighter={highlighter} />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden border border-gray-100 rounded">
                        <h5 className="m-0 px-2 py-[5px] bg-gray-50 text-sm font-medium border-b border-gray-300 flex-shrink-0">
                            Suggested
                        </h5>
                        <div className={`${contentAreaClasses} bg-gray-50`}> {/* contentAreaClasses already has min-h-0 */}
                             <CodePane title="Suggested" content={comparisonData.suggestedContent} language={comparisonSuggestedLanguage} highlighter={highlighter} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`${panelBaseClasses}`}>
                <h4 className={h4BaseClasses}>
                    {filePath ? `Loading: ${filePath}` : 'Loading...'}
                </h4>
                <div className={`flex-grow overflow-y-auto ${placeholderClasses}`}> {/* Placeholder doesn't need min-h-0 usually */}
                    Loading file content...
                </div>
            </div>
        );
    }

    if (!filePath || content === null) {
        return (
            <div className={`${panelBaseClasses}`}>
                <h4 className={h4BaseClasses}>File Content</h4>
                <div className={`flex-grow overflow-y-auto ${placeholderClasses}`}>
                    Select a file from the tree to view its content.
                </div>
            </div>
        );
    }

    return (
        <div className={`${panelBaseClasses}`}>
            <h4 className={h4BaseClasses}>Content: {filePath}</h4>
            <div className={contentAreaClasses}> {/* contentAreaClasses has min-h-0 */}
                 <CodePane title="File Content" content={content} language={singleFileLanguage} highlighter={highlighter} />
            </div>
        </div>
    );
};

export default FileContentDisplay;