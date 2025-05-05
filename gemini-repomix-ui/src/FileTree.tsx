// src/FileTree.tsx
import React from 'react';
import './FileTree.css';

interface FileTreeProps {
    structure: string[] | null;
    selectedFilePath: string | null;
    onSelectFile: (filePath: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ structure, selectedFilePath, onSelectFile }) => {
    if (!structure || structure.length === 0) {
        return <div className="file-tree-panel empty">No file structure loaded.</div>;
    }

    return (
        <div className="file-tree-panel">
            <h4>Project Files</h4>
            <ul>
                {structure.map((filePath) => (
                    <li
                        key={filePath}
                        className={filePath === selectedFilePath ? 'selected' : ''}
                        onClick={() => onSelectFile(filePath)}
                        title={filePath} // Show full path on hover
                    >
                        {/* Basic display: just the filename part */}
                        {filePath.split('/').pop() || filePath}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FileTree;