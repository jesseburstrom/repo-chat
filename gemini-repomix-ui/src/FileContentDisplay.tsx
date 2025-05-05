// src/FileContentDisplay.tsx
import React from 'react';
// Consider using Shikiji for syntax highlighting later if desired
// import { getHighlighter, bundledLanguages } from 'shikiji';
// import type { Highlighter } from 'shikiji';
import './FileContentDisplay.css';

interface FileContentDisplayProps {
    filePath: string | null;
    content: string | null;
    isLoading: boolean; // Add isLoading prop
}

// Basic version using <pre>
const FileContentDisplay: React.FC<FileContentDisplayProps> = ({ filePath, content, isLoading }) => {
    let displayContent: React.ReactNode = null;

    if (isLoading) {
        displayContent = <div className="loading-placeholder">Loading file content...</div>;
    } else if (filePath && content !== null) {
        // Basic <pre> tag display
        displayContent = <pre><code>{content}</code></pre>;
        // TODO: Implement Shikiji syntax highlighting here for better rendering
        // const fileExtension = filePath.split('.').pop() || 'txt'; // Basic lang detection
        // Need async logic like in ChatInterface if using Shikiji
    } else {
        displayContent = <div className="placeholder">Select a file from the tree to view its content.</div>;
    }

    return (
        <div className="file-content-panel">
            <h4>{filePath ? `Content: ${filePath.split('/').pop()}` : 'File Content'}</h4>
            <div className="content-area">
                {displayContent}
            </div>
        </div>
    );
};

export default FileContentDisplay;
