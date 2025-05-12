// src/FileTree.tsx
import React, { useMemo } from 'react';
// Removed: import './FileTree.css'; // We are migrating away from this

// --- Define a TreeNode structure ---
interface TreeNode {
    path: string;
    name: string;
    children: TreeNode[];
    isFolder: boolean;
    depth: number;
}

interface FileTreeProps {
    structure: string[] | null;
    selectedFilePath: string | null;
    onSelectFile: (filePath: string) => void;
    promptSelectedFilePaths: string[];
    onTogglePromptSelectedFile: (filePath: string) => void;
    onSelectAllPromptFiles: () => void;
    onDeselectAllPromptFiles: () => void;
}

// --- Helper Function to Build the Tree (remains the same) ---
const buildTree = (paths: string[]): TreeNode[] => {
    // ... (implementation from your file)
    const root: TreeNode = { path: '', name: 'root', children: [], isFolder: true, depth: -1 };

    const findOrCreateNode = (parent: TreeNode, name: string, fullPathPrefix: string): TreeNode => {
        let node = parent.children.find(child => child.name === name && child.isFolder);
        if (!node) {
            node = {
                path: fullPathPrefix,
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
            if (index === parts.length - 1) {
                currentNode.children.push({
                    path: path,
                    name: part,
                    children: [],
                    isFolder: false,
                    depth: currentNode.depth + 1
                });
            } else {
                currentNode = findOrCreateNode(currentNode, part, currentPathPrefix);
            }
        });
    });

    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => {
            if (node.isFolder) {
                sortNodes(node.children);
            }
        });
    };

    sortNodes(root.children);
    return root.children;
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
    const indentation = node.depth * 15; // pixels

    const handleFileTextClick = () => {
        if (!node.isFolder) {
            onSelectFile(node.path);
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (!node.isFolder) {
            onTogglePromptSelectedFile(node.path);
        }
    };

    // Apply Tailwind styles to list items
    const liBaseClasses = "flex items-center rounded whitespace-nowrap overflow-hidden text-ellipsis text-sm transition-colors duration-150 ease-in-out";
    // text-sm is approx 0.9em, py-1 is 4px vertical padding
    const fileNameWrapperBaseClasses = "cursor-pointer flex-grow overflow-hidden text-ellipsis whitespace-nowrap py-1 pl-1";


    return (
        <>
            <li
                className={`${liBaseClasses} hover:bg-gray-200`} // Using hover:bg-gray-200 for #e9ecef
                title={node.path}
                style={{ paddingLeft: `${indentation + (!node.isFolder ? 0 : 20)}px` }}
            >
                {!node.isFolder && (
                    <input
                        type="checkbox"
                        checked={promptSelectedFilePaths.includes(node.path)}
                        onChange={handleCheckboxChange}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select file ${node.name} for prompt`}
                        className="mr-1.5 flex-shrink-0 cursor-pointer" // mr-1.5 for 6px
                    />
                )}
                <span
                    className={`${fileNameWrapperBaseClasses} ${node.isFolder ? 'cursor-default' : ''} ${isSelectedForViewing && !node.isFolder ? 'bg-[#cfe2ff] font-medium text-[#0a58ca]' : ''}`}
                    onClick={handleFileTextClick}
                >
                    {node.isFolder ? '📁' : '📄'} {node.name}
                </span>
            </li>
            {node.isFolder && node.children.length > 0 && (
                <ul className="list-none p-0 m-0"> {/* No extra padding/margin for nested ul */}
                    {node.children.map(child => (
                        <TreeNodeComponent
                            key={child.path}
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

    const treeData = useMemo(() => {
        if (!structure || structure.length === 0) {
            return [];
        }
        return buildTree(structure);
    }, [structure]);

    if (!structure || structure.length === 0) {
        return <div className="w-full h-full p-4 text-gray-500 italic bg-gray-50 border-r border-gray-200">No file structure loaded.</div>;
    }

    return (
        // Apply w-full, h-full and other base styles for the panel
        <div className="w-full h-full p-2.5 bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col">
            <h4 className="mt-0 mb-2.5 text-[0.95em] text-gray-700 font-medium border-b border-gray-300 pb-[5px] flex-shrink-0">
                Project Files (for Prompt Context)
            </h4>
            {treeData.length > 0 && (
                <div className="flex gap-2 mb-2 px-2 flex-shrink-0">
                    <button
                        onClick={onSelectAllPromptFiles}
                        title="Select all files to include in prompt"
                        className="px-[7px] py-[3px] text-xs bg-gray-200 border border-gray-300 rounded cursor-pointer hover:bg-gray-300"
                    >
                        Select All
                    </button>
                    <button
                        onClick={onDeselectAllPromptFiles}
                        title="Deselect all files from prompt"
                        className="px-[7px] py-[3px] text-xs bg-gray-200 border border-gray-300 rounded cursor-pointer hover:bg-gray-300"
                    >
                        Deselect All
                    </button>
                </div>
            )}
            <ul className="list-none p-0 m-0 flex-grow overflow-y-auto"> {/* Added flex-grow and overflow for the list itself */}
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