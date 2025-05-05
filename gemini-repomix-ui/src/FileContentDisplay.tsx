// src/FileContentDisplay.tsx
import React from 'react';
import './FileContentDisplay.css';

interface FileContentDisplayProps {
    filePath: string | null;
    content: string | null;
    isLoading: boolean;
}

const FileContentDisplay: React.FC<FileContentDisplayProps> = ({ filePath, content, isLoading }) => {
    let displayContent: React.ReactNode = null;

    if (isLoading) {
        displayContent = <div className="loading-placeholder">Loading file content...</div>;
    } else if (filePath && content !== null) {
        displayContent = <pre><code>{content}</code></pre>;
    } else {
        displayContent = <div className="placeholder">Select a file from the tree to view its content.</div>;
    }

    return (
        <div className="file-content-panel">
            {/* --- MODIFIED LINE --- */}
            {/* Display the full filePath directly */}
            <h4>{filePath ? `Content: ${filePath}` : 'File Content'}</h4>
            {/* Add title attribute for potentially long paths */}
            {filePath && <h4 title={filePath} style={{ /* Optional styles like text-overflow if needed */ }}>Content: {filePath}</h4>}
            {!filePath && <h4>File Content</h4>}
            {/* --- END MODIFICATION --- */}

            <div className="content-area">
                {displayContent}
            </div>
        </div>
    );
};

export default FileContentDisplay;