// src/FileTree.tsx
import React, { useMemo } from 'react';
import './FileTree.css'; // Ensure CSS supports indentation

// --- Define a TreeNode structure ---
interface TreeNode {
    path: string;       // Full path (for files) or prefix (for folders)
    name: string;       // Name to display (filename or folder name)
    children: TreeNode[];
    isFolder: boolean;
    depth: number;      // For indentation
}

interface FileTreeProps {
    structure: string[] | null;
    selectedFilePath: string | null; // For viewing
    onSelectFile: (filePath: string) => void; // For viewing
    promptSelectedFilePaths: string[]; // For prompt inclusion
    onTogglePromptSelectedFile: (filePath: string) => void; // For prompt inclusion
    onSelectAllPromptFiles: () => void;
    onDeselectAllPromptFiles: () => void;
}

// --- Helper Function to Build the Tree ---
const buildTree = (paths: string[]): TreeNode[] => {
    const root: TreeNode = { path: '', name: 'root', children: [], isFolder: true, depth: -1 }; // Temporary root

    // Helper to find or create nodes
    const findOrCreateNode = (parent: TreeNode, name: string, fullPathPrefix: string): TreeNode => {
        let node = parent.children.find(child => child.name === name && child.isFolder);
        if (!node) {
            node = {
                path: fullPathPrefix, // Store the path prefix for folders
                name: name,
                children: [],
                isFolder: true,
                depth: parent.depth + 1
            };
            parent.children.push(node);
        }
        return node;
    };

    paths.forEach(path => {
        const parts = path.split('/');
        let currentNode = root;
        let currentPathPrefix = '';

        parts.forEach((part, index) => {
            currentPathPrefix = currentPathPrefix ? `${currentPathPrefix}/${part}` : part;
            if (index === parts.length - 1) { // It's a file
                currentNode.children.push({
                    path: path, // Full path for files
                    name: part,
                    children: [],
                    isFolder: false,
                    depth: currentNode.depth + 1
                });
            } else { // It's a directory part
                currentNode = findOrCreateNode(currentNode, part, currentPathPrefix);
            }
        });
    });

    // Sort children alphabetically (folders first, then files)
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1; // Folders first
            }
            return a.name.localeCompare(b.name); // Then alphabetical
        });
        nodes.forEach(node => {
            if (node.isFolder) {
                sortNodes(node.children);
            }
        });
    };

    sortNodes(root.children);
    return root.children; // Return only the children of the temporary root
};

// --- Recursive Rendering Component ---
interface TreeNodeProps {
    node: TreeNode;
    selectedFilePath: string | null;
    onSelectFile: (filePath: string) => void;
    promptSelectedFilePaths: string[];
    onTogglePromptSelectedFile: (filePath: string) => void;
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({
    node,
    selectedFilePath,
    onSelectFile,
    promptSelectedFilePaths,
    onTogglePromptSelectedFile
}) => {
    const isSelectedForViewing = !node.isFolder && node.path === selectedFilePath;
    const indentation = node.depth * 15; // Adjust indentation amount as needed (pixels)

    const handleFileTextClick = () => {
        if (!node.isFolder) {
            onSelectFile(node.path);
        }
        // TODO: Implement folder expansion/collapse state if desired
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent any parent click handlers
        if (!node.isFolder) { // Should only be for files
            onTogglePromptSelectedFile(node.path);
        }
    };

    return (
        <>
            <li
                className={`${node.isFolder ? 'folder' : 'file'} ${isSelectedForViewing ? 'selected-for-viewing' : ''}`}
                title={node.path} // Show full path on hover
                style={{ paddingLeft: `${indentation + (!node.isFolder ? 0 : 20)}px` }} // Apply indentation, shift folders if no checkbox
            >
                {!node.isFolder && (
                    <input
                        type="checkbox"
                        checked={promptSelectedFilePaths.includes(node.path)}
                        onChange={handleCheckboxChange}
                        onClick={(e) => e.stopPropagation()} // Ensure click doesn't bubble
                        aria-label={`Select file ${node.name} for prompt`}
                    />
                )}
                <span className="file-name-wrapper" onClick={handleFileTextClick}>
                    {node.isFolder ? '📁' : '📄'} {node.name} {/* Basic icons */}
                </span>
            </li>
            {node.isFolder && node.children.length > 0 && (
                // TODO: Wrap children in a conditional block based on expansion state
                <ul>
                    {node.children.map(child => (
                        <TreeNodeComponent
                            key={child.path} // Use path as key (should be unique)
                            node={child}
                            selectedFilePath={selectedFilePath}
                            onSelectFile={onSelectFile}
                            promptSelectedFilePaths={promptSelectedFilePaths}
                            onTogglePromptSelectedFile={onTogglePromptSelectedFile}
                        />
                    ))}
                </ul>
            )}
        </>
    );
};


// --- Main FileTree Component ---
const FileTree: React.FC<FileTreeProps> = ({
    structure,
    selectedFilePath,
    onSelectFile,
    promptSelectedFilePaths,
    onTogglePromptSelectedFile,
    onSelectAllPromptFiles,
    onDeselectAllPromptFiles }) => {
    // Memoize the tree structure generation
    const treeData = useMemo(() => {
        if (!structure || structure.length === 0) {
            return [];
        }
        return buildTree(structure);
    }, [structure]); // Rebuild only if the structure array changes

    if (!structure || structure.length === 0) {
        return <div className="file-tree-panel empty">No file structure loaded.</div>;
    }

    return (
        <div className="file-tree-panel">
            <h4>Project Files (for Prompt Context)</h4>
            {treeData.length > 0 && (
                <div className="file-tree-controls">
                    <button onClick={onSelectAllPromptFiles} title="Select all files to include in prompt">Select All</button>
                    <button onClick={onDeselectAllPromptFiles} title="Deselect all files from prompt">Deselect All</button>
                </div>
            )}
            <ul>
                {treeData.map((node) => (
                     <TreeNodeComponent
                        key={node.path}
                        node={node}
                        selectedFilePath={selectedFilePath}
                        onSelectFile={onSelectFile}
                        promptSelectedFilePaths={promptSelectedFilePaths}
                        onTogglePromptSelectedFile={onTogglePromptSelectedFile}
                    />
                ))}
            </ul>
        </div>
    );
};

export default FileTree;