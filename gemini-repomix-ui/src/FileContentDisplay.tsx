// src/FileContentDisplay.tsx
import React, { useState, useEffect } from 'react';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';
import './FileContentDisplay.css';

// --- Reusable Shikiji Hook (Keep as is or import) ---
const useShikijiHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hl = await getHighlighter({
          themes: ['material-theme-lighter'],
          langs: Object.keys(bundledLanguages),
        });
        if (isMounted) setHighlighter(hl);
      } catch (err) {
        console.error('Failed to initialise Shikiji in FileContentDisplay:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return highlighter;
};
// --- End Reusable Hook ---


// --- Helper Function to Guess Language (Keep as is) ---
const getLanguageFromPath = (filePath: string | null): string => {
    if (!filePath) return 'plaintext';
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'ts':
        case 'tsx': return 'typescript';
        case 'js':
        case 'jsx': return 'javascript';
        case 'css': return 'css';
        case 'py': return 'python';
        case 'go': return 'go';
        case 'cs': return 'csharp';
        case 'md': return 'markdown';
        case 'json': return 'json';
        case 'html': return 'html';
        case 'xml': return 'xml';
        default: return 'plaintext';
    }
};
// --- End Helper Function ---


interface FileContentDisplayProps {
    filePath: string | null;
    content: string | null;
    isLoading: boolean;
}

const FileContentDisplay: React.FC<FileContentDisplayProps> = ({ filePath, content, isLoading }) => {
    const highlighter = useShikijiHighlighter();
    const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

    // *** CORRECTED useEffect ***
    useEffect(() => {
        if (isLoading || !content || !highlighter) {
            if (highlightedHtml !== null) {
                 setHighlightedHtml(null);
            }
            return; // Exit early
        }

        let isMounted = true; // Prevent state update on unmounted component
        const lang = getLanguageFromPath(filePath);
        console.log(`FileContentDisplay: Attempting to highlight ${filePath} as language: ${lang}`);

        // Define an async function inside the effect
        const performHighlight = async () => {
            try {
                // Await the result of codeToHtml
                const htmlResult: string = await highlighter.codeToHtml(content, {
                    lang: lang,
                    theme: 'material-theme-lighter'
                });

                if (isMounted) {
                    setHighlightedHtml(htmlResult);
                }
            } catch (error: any) { // Catch errors and explicitly type 'error'
                console.warn(`Shikiji failed to highlight ${filePath} (lang: ${lang}):`, error);
                 if (isMounted) {
                    setHighlightedHtml(null); // Fallback: Clear highlighted HTML so plain text is shown
                 }
            }
        };

        performHighlight(); // Call the async function

        // Cleanup function
        return () => {
            isMounted = false;
        };

    // Add highlightedHtml to dependencies ONLY if clearing it depends on other state changes within this effect
    // In this specific setup, removing it might be okay if clearing only happens on load/no content/no highlighter.
    // Let's keep it for now to be safe about resetting state.
    }, [content, highlighter, filePath, isLoading, highlightedHtml]);
    // *** END CORRECTED useEffect ***


    // --- Rendering Logic (Keep as is) ---
    let displayContent: React.ReactNode = null;

    if (isLoading) {
        displayContent = <div className="loading-placeholder">Loading file content...</div>;
    } else if (filePath && content !== null) {
        if (highlightedHtml) {
            displayContent = <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />;
        } else {
            console.log(`FileContentDisplay: Rendering plain text fallback for ${filePath}`);
            displayContent = <pre><code>{content}</code></pre>;
        }
    } else {
        displayContent = <div className="placeholder">Select a file from the tree to view its content.</div>;
    }

    return (
        <div className="file-content-panel">
             {/* --- Use the simplified header from your last version --- */}
             <h4 title={filePath || 'File Content'}>
                 {filePath ? `Content: ${filePath}` : 'File Content'}
             </h4>
            {/* --- End simplified header --- */}
            <div className="content-area">
                {displayContent}
            </div>
        </div>
    );
};

export default FileContentDisplay;