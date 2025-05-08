// gemini-repomix-ui/src/hooks/useRepomix.ts
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
    const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
    const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
    const [repoListError, setRepoListError] = useState<string | null>(null);

    const [selectedRepoFile, setSelectedRepoFile] = useState<string>("");
    const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
    const [fileContentError, setFileContentError] = useState<string | null>(null);

    // const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null); // --- REMOVED ---
    const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
    
    const [parsedRepomixData, setParsedRepomixData] = useState<ParsedRepomixData | null>(null);
    const [selectedFilePathForView, setSelectedFilePathForView] = useState<string | null>(null);
    const [selectedFileContentForView, setSelectedFileContentForView] = useState<string | null>(null);
    const [isLoadingSelectedFileForView, setIsLoadingSelectedFileForView] = useState(false);

    const [promptSelectedFilePaths, setPromptSelectedFilePaths] = useState<string[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationMessage, setGenerationMessage] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
    const attachmentStatusTimer = useRef<number | null>(null);

    const justGeneratedFile = useRef<string | null>(null);

    const clearAttachmentStatus = useCallback(() => {
        if (attachmentStatusTimer.current) {
          clearTimeout(attachmentStatusTimer.current);
          attachmentStatusTimer.current = null;
        }
        setAttachmentStatus(null);
    }, []);

    const clearFileData = useCallback(() => { 
        // setAttachedFileContent(null); // --- REMOVED ---
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
        setRepoListError(null);
        clearFileData();
        setSelectedRepoFile(filename);
        clearAttachmentStatus();
        setAttachmentStatus(`Attaching ${filename}...`);
        
        const selectedRepoInfo = availableRepos.find(repo => repo.filename === filename);
        if (selectedRepoInfo?.repoIdentifier) {
            setRepoUrl(`https://github.com/${selectedRepoInfo.repoIdentifier}`);
        }

        const result = await apiGetFileContent(filename);
        if (result.success && result.content) {
            const rawContent = result.content; // Keep rawContent local
            // setAttachedFileContent(rawContent); // --- REMOVED ---
            setAttachedFileName(filename);
            const parsedData = parseRepomixFile(rawContent); // Use rawContent directly

            if (parsedData) {
                setParsedRepomixData(parsedData);
                setAttachmentStatus(`Attached & Parsed ${filename} successfully.`);
                setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
            } else {
                setParsedRepomixData(null);
                setAttachmentStatus(`Attached ${filename} (non-standard format or parse error).`);
                setPromptSelectedFilePaths([]);
            }
            if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
            attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 3000);
            setIsLoadingFileContent(false);
            return true;
        } else {
            setFileContentError(`Failed to load content for ${filename}: ${result.error || 'Unknown error'}`);
            clearFileData();
            setSelectedRepoFile("");
            setAttachmentStatus(`Failed to attach ${filename}.`);
            if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
            attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 5000);
            setIsLoadingFileContent(false);
            return false;
        }
    }, [clearFileData, availableRepos, clearAttachmentStatus]);

    useEffect(() => {
        if (justGeneratedFile.current && availableRepos.find(r => r.filename === justGeneratedFile.current)) {
            const filenameToLoad = justGeneratedFile.current;
            justGeneratedFile.current = null; 

            console.log(`[useRepomix Effect] New file "${filenameToLoad}" detected in list. Attempting to load.`);
            (async () => { 
                const loaded = await loadRepoFileContent(filenameToLoad);
                if (loaded) {
                    setGenerationMessage(`Generated & Loaded: ${filenameToLoad}`);
                } else {
                    setGenerationError(`Generated ${filenameToLoad}, but failed to load/parse it. Please try selecting it manually.`);
                    setGenerationMessage(null);
                }
            })();
        }
    }, [availableRepos, loadRepoFileContent, setGenerationMessage, setGenerationError]);


    const handleManualFileAttach = useCallback((file: File) => {
        setFileContentError(null);
        setGenerationMessage(null);
        setGenerationError(null);
        clearAttachmentStatus();
        clearFileData();
        setSelectedRepoFile("");

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            // setAttachedFileContent(content); // --- REMOVED ---
            setAttachedFileName(file.name);
            const parsedData = parseRepomixFile(content); // Use content directly
            setParsedRepomixData(parsedData);
            if (parsedData) {
              setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
              setAttachmentStatus(`Attached & Parsed ${file.name} successfully.`);
            } else {
              setPromptSelectedFilePaths([]);
              setAttachmentStatus(`Attached ${file.name} (non-standard format or parse error).`);
            }
            if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
            attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 3000);
        };
        reader.onerror = (err) => {
            setFileContentError(`Error reading file: ${err}`);
            clearFileData();
            setAttachmentStatus(`Failed to attach ${file.name}.`);
            if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
            attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 5000);
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
        justGeneratedFile.current = null;

        const result = await apiRunRepomix({ repoUrl: generateRepoUrl, includePatterns, excludePatterns });

        if (result.success && result.outputFilename) {
            justGeneratedFile.current = result.outputFilename;
            setGenerationMessage(`Success! Generated: ${result.outputFilename}. Refreshing list and preparing to load...`);
            await fetchAvailableRepos();
        } else {
            setGenerationError(result.error || "Repomix finished, but no output filename or an error occurred.");
            if (result.stderr) console.warn("Repomix stderr:", result.stderr);
            setGenerationMessage(null);
            justGeneratedFile.current = null;
        }
        setIsGenerating(false);
    }, [clearFileData, fetchAvailableRepos, clearAttachmentStatus, ]);
    
    const handleSelectFileForViewing = useCallback((filePath: string) => {
        if (!parsedRepomixData || !filePath) {
            setSelectedFilePathForView(null);
            setSelectedFileContentForView(null);
            return;
        }
        setIsLoadingSelectedFileForView(true);
        setSelectedFilePathForView(filePath);
        const content = parsedRepomixData.fileContents[filePath];
        setSelectedFileContentForView(content !== undefined ? content : `// Error: Content for ${filePath} not found in parsed data.`);
        setIsLoadingSelectedFileForView(false);
    }, [parsedRepomixData ]);

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
        repoUrl,
        onRepoUrlChange: setRepoUrl,
        includePatterns: "**/*.css,**/*.dart,**/*.ts,**/*.tsx,**/*.py,**/*.cs,**/*.go",
        excludePatterns: "*.log,tmp/",
        handleGenerateRepomixFile,
        isGenerating,
        generationMessage,
        generationError,

        availableRepos,
        isLoadingRepos,
        repoListError,
        selectedRepoFile,
        loadRepoFileContent,
        isLoadingFileContent,
        fileContentError,

        handleManualFileAttach,
        attachedFileName,
        // attachedFileContent removed from return
        parsedRepomixData,
        selectedFilePathForView,
        selectedFileContentForView,
        isLoadingSelectedFileForView,
        handleSelectFileForViewing,

        promptSelectedFilePaths,
        handleTogglePromptSelectedFile,
        handleSelectAllPromptFiles,
        handleDeselectAllPromptFiles,
        allFilePathsInCurrentRepomix,

        attachmentStatus,
    };
}