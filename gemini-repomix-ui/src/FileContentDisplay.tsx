// FilePath: gemini-repomix-ui/src/FileContentDisplay.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';
import './FileContentDisplay.css';

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
    // For single file view
    filePath: string | null;
    content: string | null;
    isLoading: boolean;

    // For comparison view
    comparisonData: ComparisonViewData | null;
    onCloseComparison?: () => void;
}

// --- CodePane Sub-Component (Corrected) ---
const CodePane: React.FC<{ content: string; language: string; highlighter: Highlighter | null; title: string }> =
  React.memo(({ content, language, highlighter, title }) => {
    const [html, setHtml] = useState<string | null>(null);
    const [isHighlighting, setIsHighlighting] = useState(false);

    useEffect(() => {
        let isActive = true; // To prevent state updates on unmounted component

        const highlightContent = async () => {
            if (!highlighter || typeof content !== 'string') { // Ensure content is a string
                const safeContent = typeof content === 'string' ? content.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
                if (isActive) {
                    setHtml(`<pre><code>${safeContent || ''}</code></pre>`);
                    setIsHighlighting(false);
                }
                return;
            }

            if (isActive) setIsHighlighting(true);

            try {
                // Use async/await for highlighter.codeToHtml
                const resultHtml: string = await highlighter.codeToHtml(content, { lang: language, theme: 'material-theme-lighter' });
                if (isActive) {
                    setHtml(resultHtml);
                }
            } catch (err: any) { // Explicitly type err (or use 'Error' or 'unknown')
                console.warn(`Highlighting error for ${title} (lang: ${language}):`, err);
                const safeContent = content.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Content is known to be string here
                if (isActive) {
                    setHtml(`<pre><code>${safeContent}</code></pre>`); // Fallback to unhighlighted
                }
            } finally {
                if (isActive) {
                    setIsHighlighting(false);
                }
            }
        };

        highlightContent();

        return () => {
            isActive = false; // Cleanup on unmount
        };
    }, [content, language, highlighter, title]); // Dependencies for the effect

    // Rendering logic for CodePane
    if (isHighlighting && !html) return <div className="loading-placeholder">Highlighting {title}...</div>;
    if (!html) { // Fallback if html is still null (e.g., initial render or error before first highlight)
        const safeContent = typeof content === 'string' ? content.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        return <pre><code>{safeContent}</code></pre>;
    }
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
});
// --- End CodePane Sub-Component ---


// --- Main FileContentDisplay Component ---
const FileContentDisplay: React.FC<FileContentDisplayProps> = ({
    filePath,
    content,
    isLoading,
    comparisonData,
    onCloseComparison,
}) => {
    const highlighter = useShikijiHighlighterInstance();

    // Memoized language calculations
    const singleFileLanguage = useMemo(() => getLanguageFromPath(filePath), [filePath]);
    const comparisonOriginalLanguage = useMemo(() => getLanguageFromPath(comparisonData?.filePath || null), [comparisonData?.filePath]);
    const comparisonSuggestedLanguage = comparisonOriginalLanguage; // Assume same lang for suggested

    // Comparison View
    if (comparisonData) {
        return (
            <div className="file-content-panel comparison-active">
                <div className="comparison-header">
                    <h4>Comparing: {comparisonData.filePath}</h4>
                    {onCloseComparison && <button onClick={onCloseComparison} className="close-comparison-button">Close Comparison</button>}
                </div>
                <div className="comparison-panes">
                    <div className="pane original-pane">
                        <h5>Original</h5>
                        <div className="content-area">
                            <CodePane title="Original" content={comparisonData.originalContent} language={comparisonOriginalLanguage} highlighter={highlighter} />
                        </div>
                    </div>
                    <div className="pane suggested-pane">
                        <h5>Suggested</h5>
                        <div className="content-area">
                             <CodePane title="Suggested" content={comparisonData.suggestedContent} language={comparisonSuggestedLanguage} highlighter={highlighter} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Single File View
    if (isLoading) {
        return (
            <div className="file-content-panel">
                <h4>{filePath ? `Loading: ${filePath}` : 'Loading...'}</h4>
                <div className="content-area loading-placeholder">Loading file content...</div>
            </div>
        );
    }

    if (!filePath || content === null) {
        return (
            <div className="file-content-panel">
                <h4>File Content</h4>
                <div className="content-area placeholder">
                    Select a file from the tree to view its content.
                </div>
            </div>
        );
    }

    return (
        <div className="file-content-panel">
            <h4>Content: {filePath}</h4>
            <div className="content-area">
                 <CodePane title="File Content" content={content} language={singleFileLanguage} highlighter={highlighter} />
            </div>
        </div>
    );
};

export default FileContentDisplay;