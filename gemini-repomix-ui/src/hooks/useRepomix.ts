// src/hooks/useRepomix.ts
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    listGeneratedFiles as apiListGeneratedFiles,
    getFileContent as apiGetFileContent,
    runRepomix as apiRunRepomix,
    
} from '../services/api';
import { parseRepomixFile, ParsedRepomixData } from '../utils/parseRepomix';
import type { RepoInfo } from '../RepoSelector';

// Helper function (can be moved to utils if used elsewhere)
const getAllFilePathsFromParsedData = (data: ParsedRepomixData | null): string[] => {
    if (!data || !data.directoryStructure || !data.fileContents) return [];
    return data.directoryStructure.filter(p => data.fileContents.hasOwnProperty(p) && !p.endsWith('/'));
};

export function useRepomix(initialRepoUrl: string = '') {
    const [repoUrl, setRepoUrl] = useState(initialRepoUrl); // For generation form
    const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
    const [repoListError, setRepoListError] = useState<string | null>(null);

    const [selectedRepoFile, setSelectedRepoFile] = useState<string>(""); // Filename of the selected .md repomix output
    const [isLoadingFileContent, setIsLoadingFileContent] = useState(false); // For loading the .md file
    const [fileContentError, setFileContentError] = useState<string | null>(null);


    const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null); // Content of the loaded .md file
    const [attachedFileName, setAttachedFileName] = useState<string | null>(null); // Name of the loaded .md file
    
    const [parsedRepomixData, setParsedRepomixData] = useState<ParsedRepomixData | null>(null);
    const [selectedFilePathForView, setSelectedFilePathForView] = useState<string | null>(null); // Path of a file within the parsed repomix structure to view
    const [selectedFileContentForView, setSelectedFileContentForView] = useState<string | null>(null);
    const [isLoadingSelectedFileForView, setIsLoadingSelectedFileForView] = useState(false);

    const [promptSelectedFilePaths, setPromptSelectedFilePaths] = useState<string[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationMessage, setGenerationMessage] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
    const attachmentStatusTimer = useRef<number | null>(null);

    const clearAttachmentStatus = useCallback(() => {
        if (attachmentStatusTimer.current) {
          clearTimeout(attachmentStatusTimer.current);
          attachmentStatusTimer.current = null;
        }
        setAttachmentStatus(null);
    }, []);

    const clearFileData = useCallback(() => { 
        setAttachedFileContent(null);
        setAttachedFileName(null);
        setParsedRepomixData(null);
        setSelectedFilePathForView(null);
        setPromptSelectedFilePaths([]);
        setSelectedFileContentForView(null);
    }, []);


    const fetchAvailableRepos = useCallback(async () => {
        setIsLoadingRepos(true);
        setRepoListError(null);
        const result = await apiListGeneratedFiles();
        if (result.success) {
            setAvailableRepos(result.data || []);
        } else {
            setRepoListError(result.error || "Could not load repo list.");
            setAvailableRepos([]);
        }
        setIsLoadingRepos(false);
    }, []);

    useEffect(() => {
        fetchAvailableRepos();
    }, [fetchAvailableRepos]);

    const loadRepoFileContent = useCallback(async (filename: string): Promise<boolean> => {
        if (!filename) {
            clearFileData();
            setSelectedRepoFile("");
            clearAttachmentStatus();
            return false;
        }
        setIsLoadingFileContent(true);
        setFileContentError(null);
        setRepoListError(null); // Clear previous repo list error
        clearFileData();
        setSelectedRepoFile(filename);
        clearAttachmentStatus();
        setAttachmentStatus(`Attaching ${filename}...`);
        
        const selectedRepoInfo = availableRepos.find(repo => repo.filename === filename);
        if (selectedRepoInfo?.repoIdentifier) {
            // This updates the repoUrl for the RepomixForm, which might be unexpected
            // Consider if this auto-update is desired or if repoUrl for form should be separate
            setRepoUrl(`https://github.com/${selectedRepoInfo.repoIdentifier}`);
        }

        const result = await apiGetFileContent(filename);
        if (result.success && result.content) {
            const rawContent = result.content; // Store in a local variable
            setAttachedFileContent(rawContent); // Set the state
            setAttachedFileName(filename);
            const parsedData = parseRepomixFile(result.content);

            if (parsedData) {
                setParsedRepomixData(parsedData);
                setAttachmentStatus(`Attached & Parsed ${filename} successfully.`);
                setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
            } else {
                setParsedRepomixData(null);
                setAttachmentStatus(`Attached ${filename} (non-standard format?).`);
                setPromptSelectedFilePaths([]);
            }
            attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 3000);
            setIsLoadingFileContent(false);
            return true;
        } else {
            setFileContentError(`Failed to load content for ${filename}: ${result.error || 'Unknown error'}`);
            clearFileData();
            setSelectedRepoFile("");
            setAttachmentStatus(`Failed to attach ${filename}.`);
            attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 5000);
            setIsLoadingFileContent(false);
            return false;
        }
    }, [clearFileData, availableRepos, clearAttachmentStatus]);

    const handleManualFileAttach = useCallback((file: File) => {
        // setIsLoading(true); // This isLoading is for chat, handle separately
        setFileContentError(null);
        setGenerationMessage(null);
        setGenerationError(null);
        clearAttachmentStatus();
        clearFileData();
        setSelectedRepoFile(""); // Clear repo selector if a file is manually attached

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setAttachedFileContent(content);
            setAttachedFileName(file.name);
            const parsedData = parseRepomixFile(content);
            setParsedRepomixData(parsedData);
            // setIsLoading(false);
            if (parsedData) {
              setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
              setAttachmentStatus(`Attached & Parsed ${file.name} successfully.`);
            } else {
              setPromptSelectedFilePaths([]);
              setAttachmentStatus(`Attached ${file.name} (non-standard format?).`);
            }
            attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 3000);
        };
        reader.onerror = (err) => {
            setFileContentError(`Error reading file: ${err}`); // Or use a dedicated error state
            clearFileData();
            // setIsLoading(false);
            setAttachmentStatus(`Failed to attach ${file.name}.`);
            attachmentStatusTimer.current = setTimeout(clearAttachmentStatus, 5000);
        };
        reader.readAsText(file);
    }, [clearFileData, clearAttachmentStatus]);

    const handleGenerateRepomixFile = useCallback(async (
        generateRepoUrl: string, includePatterns: string, excludePatterns: string
    ) => {
        setIsGenerating(true);
        setGenerationMessage(null);
        setGenerationError(null);
        clearFileData();
        clearAttachmentStatus();
        setSelectedRepoFile("");

        const result = await apiRunRepomix({ repoUrl: generateRepoUrl, includePatterns, excludePatterns });

        if (result.success && result.outputFilename) {
            setGenerationMessage(`Success! Generated: ${result.outputFilename}. Loading...`);
            await fetchAvailableRepos(); // Refresh the list
            // It's good practice to ensure fetchAvailableRepos has completed before trying to load
            // A simple timeout isn't robust. Better to chain promises or use async/await properly.
            // For now, we assume fetchAvailableRepos updates `availableRepos` state,
            // and loadRepoFileContent will use that updated state.
            
            // Wait briefly for state update from fetchAvailableRepos, then load.
            // This is a slight hack; a more robust way would be to pass the new file info directly.
             setTimeout(async () => {
                const loaded = await loadRepoFileContent(result.outputFilename!); // `!` because we checked for it
                if (loaded) {
                    setGenerationMessage(`Generated & Loaded: ${result.outputFilename}`);
                    setSelectedRepoFile(result.outputFilename!); // Ensure it's selected in the dropdown
                } else {
                    setGenerationError(`Generated ${result.outputFilename}, but failed to load/parse.`);
                    setGenerationMessage(null);
                }
            }, 200); 
        } else {
            setGenerationError(result.error || "Repomix finished, but no output filename or an error occurred.");
            if (result.stderr) console.warn("Repomix stderr:", result.stderr);
            setGenerationMessage(null);
        }
        setIsGenerating(false);
    }, [clearFileData, fetchAvailableRepos, loadRepoFileContent, clearAttachmentStatus]);
    
    const handleSelectFileForViewing = useCallback((filePath: string) => {
        if (!parsedRepomixData) return;
        // if (comparisonView) setComparisonView(null); // Handled in App.tsx
        setIsLoadingSelectedFileForView(true);
        setSelectedFilePathForView(filePath);
        // Simulate async loading if content isn't immediately available or for UX
        setTimeout(() => {
            const content = parsedRepomixData.fileContents[filePath];
            setSelectedFileContentForView(content !== undefined ? content : `// Error: Content not found`);
            setIsLoadingSelectedFileForView(false);
        }, 50);
    }, [parsedRepomixData]);

    const handleTogglePromptSelectedFile = useCallback((filePath: string) => {
        setPromptSelectedFilePaths(prev =>
            prev.includes(filePath) ? prev.filter(p => p !== filePath) : [...prev, filePath]
        );
    }, []);

    const allFilePathsInCurrentRepomix = useMemo(() => getAllFilePathsFromParsedData(parsedRepomixData), [parsedRepomixData]);

    const handleSelectAllPromptFiles = useCallback(() => {
        setPromptSelectedFilePaths([...allFilePathsInCurrentRepomix]);
    }, [allFilePathsInCurrentRepomix]);

    const handleDeselectAllPromptFiles = useCallback(() => {
        setPromptSelectedFilePaths([]);
    }, []);


    return {
        repoUrl, // For RepomixForm
        onRepoUrlChange: setRepoUrl, // For RepomixForm
        includePatterns: "**/*.css,**/*.dart,**/*.ts,**/*.tsx,**/*.py,**/*.cs,**/*.go", // Default, can be state if needed
        excludePatterns: "*.log,tmp/", // Default, can be state if needed
        handleGenerateRepomixFile,
        isGenerating,
        generationMessage,
        generationError,

        availableRepos,
        isLoadingRepos,
        repoListError,
        selectedRepoFile, // Filename of .md
        loadRepoFileContent, // To select from dropdown
        isLoadingFileContent, // Loading .md
        fileContentError,

        handleManualFileAttach, // For manual file input
        attachedFileName, // Name of .md or manually attached file
        attachedFileContent, // Not directly exposed, used internally to get parsedRepomixData

        parsedRepomixData,
        selectedFilePathForView, // Path of file inside .md to view
        selectedFileContentForView, // Content of file inside .md to view
        isLoadingSelectedFileForView,
        handleSelectFileForViewing,

        promptSelectedFilePaths, // Files selected for prompt context
        handleTogglePromptSelectedFile,
        handleSelectAllPromptFiles,
        handleDeselectAllPromptFiles,
        allFilePathsInCurrentRepomix, // For InputArea display

        attachmentStatus, // Generic status for attach/parse operations
    };
}