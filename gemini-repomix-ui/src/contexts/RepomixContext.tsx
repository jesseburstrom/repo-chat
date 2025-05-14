// gemini-repomix-ui/src/contexts/RepomixContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import * as api from '../services/api';
import { parseRepomixFile, ParsedRepomixData } from '../utils/parseRepomix';
import type { RepoInfo } from '../components/RepoSelector';
import { useAuth } from './AuthContext';
import { parseRepoInfoFromFilename } from '../utils/filenameUtils'; // ++ Import the new utility

interface RepomixState {
    availableRepos: RepoInfo[];
    selectedRepoFile: string | null;
    parsedRepomixData: ParsedRepomixData | null;
    isLoading: boolean;
    error: string | null;
    attachmentStatus: string | null;
    selectedFilePathForView: string | null;
    selectedFileContentForView: string | null;
    promptSelectedFilePaths: string[];
    allFilePathsInCurrentRepomix: string[];
    repoUrl: string; // ++ Add repoUrl for the form
}

interface RepomixActions {
    fetchAvailableRepos: () => Promise<void>;
    generateRepomixFile: (repoUrl: string, include: string, exclude: string) => Promise<void>;
    loadRepoFileContent: (filename: string) => Promise<boolean>;
    handleManualFileAttach: (file: File) => void;
    clearCurrentRepomixData: () => void;
    deleteRepomixFile: (filename: string) => Promise<boolean>;
    selectFileForViewing: (filePath: string) => void;
    togglePromptSelectedFile: (filePath: string) => void;
    selectAllPromptFiles: () => void;
    deselectAllPromptFiles: () => void;
    setRepoUrl: (url: string) => void; // ++ Add action to set repoUrl
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
        repoUrl: '', // ++ Initialize repoUrl
    });
    const attachmentStatusTimer = useRef<number | null>(null);

    const setAttachmentStatusWithTimeout = useCallback((message: string | null, isErrorStatus: boolean = false, timeout = 3000) => {
        if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
        setState(prev => ({
            ...prev,
            attachmentStatus: message,
            error: isErrorStatus ? message : prev.error
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
            repoUrl: '', // ++ Clear repoUrl here
            error: keepError ? prev.error : null,
        }));
        if (!keepError) setAttachmentStatusWithTimeout(null);
    }, [setAttachmentStatusWithTimeout]);

    const setRepoUrl = useCallback((url: string) => { // ++ Implement setRepoUrl action
        setState(prev => ({ ...prev, repoUrl: url }));
    }, []);

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
            setState(prev => ({ ...prev, error: "Authentication required to load file.", repoUrl: '' })); // ++ Clear repoUrl
            return false;
        }
        if (!filename) { // This handles deselection (empty filename)
            clearCurrentRepomixData(); // This will clear repoUrl
            return false;
        }
        setState(prev => ({ ...prev, isLoading: true, error: null, selectedRepoFile: filename }));
        setAttachmentStatusWithTimeout(`Attaching ${filename}...`);

        // ++ Parse filename to extract owner and repo for the URL
        const repoDetails = parseRepoInfoFromFilename(filename);
        if (repoDetails) {
            const newRepoUrl = `https://github.com/${repoDetails.owner}/${repoDetails.repoName}.git`;
            setState(prev => ({ ...prev, repoUrl: newRepoUrl }));
        } else {
            setState(prev => ({ ...prev, repoUrl: '' })); // Clear URL if parsing fails
            console.warn(`Could not parse owner/repo from filename: ${filename}`);
        }
        // --

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
                error: null,
            }));
            setAttachmentStatusWithTimeout(parsedData ? `Attached & Parsed ${filename}` : `Attached ${filename} (non-standard format or parse error)`);
            return true;
        } else {
            setState(prev => ({
                ...prev,
                isLoading: false,
                selectedRepoFile: null, // Deselect file on load failure
                error: result.error || `Failed to load ${filename}`,
                repoUrl: '' // ++ Clear repoUrl on failure
            }));
            clearCurrentRepomixData(true); // Keep error, but clear data (repoUrl already cleared above)
            setAttachmentStatusWithTimeout(`Failed to attach ${filename}: ${result.error}`, true, 5000);
            return false;
        }
    }, [session, clearCurrentRepomixData, setAttachmentStatusWithTimeout]);

    const generateRepomixFile = useCallback(async (repoUrl: string, include: string, exclude: string) => {
        if (!session) {
            setState(prev => ({ ...prev, error: "Authentication required to generate file." }));
            return;
        }
        // ++ When generating, the repoUrl is already in state via the form, or passed here.
        // We should ensure the context's repoUrl matches what's being generated.
        setState(prev => ({ ...prev, isLoading: true, error: null, repoUrl: repoUrl }));
        clearCurrentRepomixData(); // Clear previous file data but keep the new repoUrl
        setState(prev => ({...prev, repoUrl: repoUrl})); // Ensure repoUrl from argument is set for sure
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
                isLoading: false,
            }));
            setAttachmentStatusWithTimeout(result.data.message || `Generated ${newRepoInfo.filename}. Loading content...`);
            const loaded = await loadRepoFileContent(newRepoInfo.filename);
            if (!loaded) {
                // error handled by loadRepoFileContent
            }
        } else {
            const errorMessage = result.error || (result.data && !result.data.newFile ? "Repomix response missing new file data." : "Repomix generation failed.");
            setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
            setAttachmentStatusWithTimeout(`Error during generation: ${errorMessage}`, true, 5000);
        }
    }, [session, clearCurrentRepomixData, setAttachmentStatusWithTimeout, loadRepoFileContent, fetchAvailableRepos]);


    const handleManualFileAttach = useCallback((file: File) => {
        setState(prev => ({ ...prev, isLoading: true, error: null, selectedRepoFile: null, repoUrl: '' })); // ++ Clear repoUrl
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
            const wasSelectedRepoUrl = state.selectedRepoFile === filename ? '' : state.repoUrl; // ++ Clear repoUrl if deleted file was the source
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
                repoUrl: wasSelectedRepoUrl, // ++ Update repoUrl
            }));
            setAttachmentStatusWithTimeout(result.message || `File ${filename} deleted successfully.`);
            return true;
        } else {
            setState(prev => ({ ...prev, isLoading: false, error: result.error || `Failed to delete ${filename}.` }));
            setAttachmentStatusWithTimeout(`Failed to delete ${filename}: ${result.error || 'Unknown error'}`, true, 5000);
            return false;
        }
    }, [session, setAttachmentStatusWithTimeout, state.selectedRepoFile, state.repoUrl]); // ++ Added state dependencies for repoUrl update


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
            ...state, // repoUrl is in here
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
            setRepoUrl, // ++ Add the new action to context value
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