// gemini-repomix-ui/src/contexts/RepomixContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import * as api from '../services/api'; // Ensure RunRepomixResponse & DeleteFileApiResponse are correctly defined and exported here
import { parseRepomixFile, ParsedRepomixData } from '../utils/parseRepomix';
import type { RepoInfo } from '../RepoSelector'; // Assuming RepoInfo is { filename: string; repoIdentifier: string; }
import { useAuth } from './AuthContext';

interface RepomixState {
    availableRepos: RepoInfo[];
    selectedRepoFile: string | null;
    parsedRepomixData: ParsedRepomixData | null;
    isLoading: boolean; // General loading for context operations (generation, listing, loading content)
    error: string | null; // General error message for Repomix operations
    attachmentStatus: string | null; // Specific status for file attach/parse/generation messages
    selectedFilePathForView: string | null;
    selectedFileContentForView: string | null;
    promptSelectedFilePaths: string[];
    allFilePathsInCurrentRepomix: string[];
}

interface RepomixActions {
    fetchAvailableRepos: () => Promise<void>;
    generateRepomixFile: (repoUrl: string, include: string, exclude: string) => Promise<void>;
    loadRepoFileContent: (filename: string) => Promise<boolean>;
    handleManualFileAttach: (file: File) => void;
    clearCurrentRepomixData: () => void;
    deleteRepomixFile: (filename: string) => Promise<boolean>; // Action for deleting a file
    selectFileForViewing: (filePath: string) => void;
    togglePromptSelectedFile: (filePath: string) => void;
    selectAllPromptFiles: () => void;
    deselectAllPromptFiles: () => void;
}

type RepomixContextType = RepomixState & RepomixActions;

const RepomixContext = createContext<RepomixContextType | undefined>(undefined);

const getAllFilePathsFromParsedData = (data: ParsedRepomixData | null): string[] => {
    if (!data || !data.directoryStructure || !data.fileContents) return [];
    return data.directoryStructure.filter(p => data.fileContents.hasOwnProperty(p) && !p.endsWith('/'));
};

export const RepomixProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { session, isLoading: authIsLoading } = useAuth();
    const [state, setState] = useState<RepomixState>({
        availableRepos: [],
        selectedRepoFile: null,
        parsedRepomixData: null,
        isLoading: false,
        error: null,
        attachmentStatus: null,
        selectedFilePathForView: null,
        selectedFileContentForView: null,
        promptSelectedFilePaths: [],
        allFilePathsInCurrentRepomix: [],
    });
    const attachmentStatusTimer = useRef<number | null>(null);

    const setAttachmentStatusWithTimeout = useCallback((message: string | null, isErrorStatus: boolean = false, timeout = 3000) => {
        if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
        setState(prev => ({
            ...prev,
            attachmentStatus: message,
            error: isErrorStatus ? message : prev.error // Set general error if status is an error, else keep existing
        }));
        if (message) {
            attachmentStatusTimer.current = window.setTimeout(() => {
                setState(prev => ({ ...prev, attachmentStatus: null }));
            }, timeout);
        }
    }, []);

    const clearCurrentRepomixData = useCallback((keepError: boolean = false) => {
        setState(prev => ({
            ...prev,
            selectedRepoFile: null,
            parsedRepomixData: null,
            selectedFilePathForView: null,
            selectedFileContentForView: null,
            promptSelectedFilePaths: [],
            allFilePathsInCurrentRepomix: [],
            error: keepError ? prev.error : null, // Optionally keep existing general error
        }));
        if (!keepError) setAttachmentStatusWithTimeout(null); // Clear status message if not keeping error
    }, [setAttachmentStatusWithTimeout]);


    const fetchAvailableRepos = useCallback(async () => {
        if (!session || authIsLoading) {
            setState(prev => ({ ...prev, availableRepos: [], isLoading: !authIsLoading, error: null }));
            return;
        }
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        const result = await api.listGeneratedFiles();
        if (result.success) {
            setState(prev => ({ ...prev, availableRepos: result.data || [], isLoading: false }));
        } else {
            setState(prev => ({ ...prev, availableRepos: [], isLoading: false, error: result.error || "Could not load repo list." }));
        }
    }, [session, authIsLoading]);

    useEffect(() => {
        fetchAvailableRepos();
    }, [fetchAvailableRepos]);


    const loadRepoFileContent = useCallback(async (filename: string): Promise<boolean> => {
        if (!session) {
            setState(prev => ({ ...prev, error: "Authentication required to load file." }));
            return false;
        }
        if (!filename) {
            clearCurrentRepomixData();
            return false;
        }
        setState(prev => ({ ...prev, isLoading: true, error: null, selectedRepoFile: filename }));
        setAttachmentStatusWithTimeout(`Attaching ${filename}...`);

        const result = await api.getFileContent(filename);
        if (result.success && result.content) {
            const parsedData = parseRepomixFile(result.content);
            const allPaths = getAllFilePathsFromParsedData(parsedData);
            setState(prev => ({
                ...prev,
                parsedRepomixData: parsedData,
                allFilePathsInCurrentRepomix: allPaths,
                promptSelectedFilePaths: allPaths,
                isLoading: false,
                error: null, // Clear previous error on successful load
            }));
            setAttachmentStatusWithTimeout(parsedData ? `Attached & Parsed ${filename}` : `Attached ${filename} (non-standard format or parse error)`);
            return true;
        } else {
            setState(prev => ({ ...prev, isLoading: false, selectedRepoFile: null, error: result.error || `Failed to load ${filename}` }));
            clearCurrentRepomixData(true); // Keep the error from the failed load
            setAttachmentStatusWithTimeout(`Failed to attach ${filename}: ${result.error}`, true, 5000);
            return false;
        }
    }, [session, clearCurrentRepomixData, setAttachmentStatusWithTimeout]);

    const generateRepomixFile = useCallback(async (repoUrl: string, include: string, exclude: string) => {
        if (!session) {
            setState(prev => ({ ...prev, error: "Authentication required to generate file." }));
            return;
        }
        setState(prev => ({ ...prev, isLoading: true, error: null })); // Set general loading, clear error
        clearCurrentRepomixData(); // Clear previous file data
        setAttachmentStatusWithTimeout(`Generating Repomix file for ${repoUrl}...`);

        const result: api.RunRepomixResponse = await api.runRepomix({ repoUrl, includePatterns: include, excludePatterns: exclude });

        if (result.success && result.data && result.data.newFile) {
            const newRepoInfo: RepoInfo = {
                filename: result.data.newFile.filename,
                repoIdentifier: result.data.newFile.repoIdentifier
            };
            setState(prev => ({
                ...prev,
                availableRepos: [newRepoInfo, ...prev.availableRepos.filter(r => r.filename !== newRepoInfo.filename)],
                isLoading: false, // Main generation is done, loading content is next
            }));
            setAttachmentStatusWithTimeout(result.data.message || `Generated ${newRepoInfo.filename}. Loading content...`);
            const loaded = await loadRepoFileContent(newRepoInfo.filename); // loadRepoFileContent sets its own isLoading and status
            if (!loaded) {
                // Error/status already handled by loadRepoFileContent
                // Optionally, fetch all repos again if auto-load fails to ensure list consistency
                // await fetchAvailableRepos();
            }
        } else {
            const errorMessage = result.error || (result.data && !result.data.newFile ? "Repomix response missing new file data." : "Repomix generation failed.");
            setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
            setAttachmentStatusWithTimeout(`Error during generation: ${errorMessage}`, true, 5000);
        }
    }, [session, clearCurrentRepomixData, setAttachmentStatusWithTimeout, loadRepoFileContent, fetchAvailableRepos]);


    const handleManualFileAttach = useCallback((file: File) => {
        setState(prev => ({ ...prev, isLoading: true, error: null, selectedRepoFile: null }));
        clearCurrentRepomixData();
        setAttachmentStatusWithTimeout(`Attaching ${file.name}...`);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const parsedData = parseRepomixFile(content);
            const allPaths = getAllFilePathsFromParsedData(parsedData);
            setState(prev => ({
                ...prev,
                parsedRepomixData: parsedData,
                allFilePathsInCurrentRepomix: allPaths,
                promptSelectedFilePaths: allPaths,
                isLoading: false,
            }));
            setAttachmentStatusWithTimeout(parsedData ? `Attached & Parsed ${file.name}` : `Attached ${file.name} (non-standard format or parse error).`);
        };
        reader.onerror = (err) => {
            setState(prev => ({ ...prev, isLoading: false, error: `Error reading file: ${String(err)}` }));
            setAttachmentStatusWithTimeout(`Failed to attach ${file.name}.`, true, 5000);
        };
        reader.readAsText(file);
    }, [clearCurrentRepomixData, setAttachmentStatusWithTimeout]);

    const deleteRepomixFile = useCallback(async (filename: string): Promise<boolean> => {
        if (!session) {
            setState(prev => ({ ...prev, error: "Authentication required to delete file." }));
            return false;
        }
        if (!filename) {
            setState(prev => ({ ...prev, error: "No filename provided for deletion." }));
            return false;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));
        setAttachmentStatusWithTimeout(`Deleting ${filename}...`);

        const result: api.DeleteFileApiResponse = await api.deleteGeneratedFile(filename);

        if (result.success) {
            setState(prev => ({
                ...prev,
                availableRepos: prev.availableRepos.filter(repo => repo.filename !== filename),
                isLoading: false,
                error: null,
                selectedRepoFile: prev.selectedRepoFile === filename ? null : prev.selectedRepoFile,
                parsedRepomixData: prev.selectedRepoFile === filename ? null : prev.parsedRepomixData,
                selectedFilePathForView: prev.selectedRepoFile === filename ? null : prev.selectedFilePathForView,
                selectedFileContentForView: prev.selectedRepoFile === filename ? null : prev.selectedFileContentForView,
                promptSelectedFilePaths: prev.selectedRepoFile === filename ? [] : prev.promptSelectedFilePaths,
                allFilePathsInCurrentRepomix: prev.selectedRepoFile === filename ? [] : prev.allFilePathsInCurrentRepomix,
            }));
            setAttachmentStatusWithTimeout(result.message || `File ${filename} deleted successfully.`);
            return true;
        } else {
            setState(prev => ({ ...prev, isLoading: false, error: result.error || `Failed to delete ${filename}.` }));
            setAttachmentStatusWithTimeout(`Failed to delete ${filename}: ${result.error || 'Unknown error'}`, true, 5000);
            return false;
        }
    }, [session, setAttachmentStatusWithTimeout]);


    const selectFileForViewing = useCallback((filePath: string) => {
        if (!state.parsedRepomixData || !filePath || !state.parsedRepomixData.fileContents) {
            setState(prev => ({ ...prev, selectedFilePathForView: null, selectedFileContentForView: null }));
            return;
        }
        const content = state.parsedRepomixData.fileContents[filePath];
        setState(prev => ({
            ...prev,
            selectedFilePathForView: filePath,
            selectedFileContentForView: content !== undefined ? content : `// Error: Content for ${filePath} not found.`
        }));
    }, [state.parsedRepomixData]);

    const togglePromptSelectedFile = useCallback((filePath: string) => {
        setState(prev => ({
            ...prev,
            promptSelectedFilePaths: prev.promptSelectedFilePaths.includes(filePath)
                ? prev.promptSelectedFilePaths.filter(p => p !== filePath)
                : [...prev.promptSelectedFilePaths, filePath]
        }));
    }, []);

    const selectAllPromptFiles = useCallback(() => {
        if (state.allFilePathsInCurrentRepomix.length > 0) {
             setState(prev => ({ ...prev, promptSelectedFilePaths: [...prev.allFilePathsInCurrentRepomix] }));
        }
    }, [state.allFilePathsInCurrentRepomix]);

    const deselectAllPromptFiles = useCallback(() => {
        setState(prev => ({ ...prev, promptSelectedFilePaths: [] }));
    }, []);


    return (
        <RepomixContext.Provider value={{
            ...state,
            fetchAvailableRepos,
            generateRepomixFile,
            loadRepoFileContent,
            handleManualFileAttach,
            clearCurrentRepomixData,
            deleteRepomixFile,
            selectFileForViewing,
            togglePromptSelectedFile,
            selectAllPromptFiles,
            deselectAllPromptFiles,
        }}>
            {children}
        </RepomixContext.Provider>
    );
};

export const useRepomixContext = (): RepomixContextType => {
    const context = useContext(RepomixContext);
    if (context === undefined) {
        throw new Error('useRepomixContext must be used within a RepomixProvider');
    }
    return context;
};