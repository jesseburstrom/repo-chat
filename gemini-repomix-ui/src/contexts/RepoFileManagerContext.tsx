// gemini-repomix-ui/src/contexts/RepoFileManagerContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import * as api from '../services/api';
import type { RepoInfo } from '../components/RepoSelector';
import { useAuth } from './AuthContext';
import { parseRepoInfoFromFilename } from '../utils/filenameUtils';

interface RepoFileManagerState {
    availableRepoFiles: RepoInfo[];
    isLoadingRepoFiles: boolean;
    repoFilesError: string | null;
    isGenerating: boolean;
    generationStatus: { message: string | null; error: string | null };
    isDeleting: boolean;
    selectedRepoFilename: string | null;
    repoUrlForForm: string;
    fileContentVersion: number; // <--- NEW STATE
}

interface RepoFileManagerActions {
    fetchAvailableRepoFiles: () => Promise<void>;
    generateRepomixOutput: (repoUrl: string, include: string, exclude: string) => Promise<string | null>;
    deleteRepoFile: (filename: string) => Promise<boolean>;
    selectRepoFileForProcessing: (filename: string | null) => void;
    setRepoUrlForForm: (url: string) => void;
    clearGenerationStatus: () => void;
}

type RepoFileManagerContextType = RepoFileManagerState & RepoFileManagerActions;
const RepoFileManagerContext = createContext<RepoFileManagerContextType | undefined>(undefined);

export const RepoFileManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { session, isLoading: authIsLoading } = useAuth();
    const [state, setState] = useState<RepoFileManagerState>({
        availableRepoFiles: [],
        isLoadingRepoFiles: false,
        repoFilesError: null,
        isGenerating: false,
        generationStatus: { message: null, error: null },
        isDeleting: false,
        selectedRepoFilename: null,
        repoUrlForForm: '',
        fileContentVersion: 0, // <--- INITIALIZE NEW STATE
    });
    const generationStatusTimer = useRef<number | null>(null);

    const clearGenerationStatus = useCallback(() => {
        if (generationStatusTimer.current) clearTimeout(generationStatusTimer.current);
        setState(prev => ({ ...prev, generationStatus: { message: null, error: null } }));
    }, []);

    const setRepoUrlForForm = useCallback((url: string) => {
        setState(prev => ({ ...prev, repoUrlForForm: url }));
    }, []);

    const fetchAvailableRepoFiles = useCallback(async () => {
        if (!session || authIsLoading) {
            setState(prev => ({ ...prev, availableRepoFiles: [], isLoadingRepoFiles: !authIsLoading, repoFilesError: null }));
            return;
        }
        setState(prev => ({ ...prev, isLoadingRepoFiles: true, repoFilesError: null }));
        const result = await api.listGeneratedFiles();
        setState(prev => ({
            ...prev,
            availableRepoFiles: result.success ? (result.data || []) : [],
            repoFilesError: result.success ? null : (result.error || "Could not load repo list."),
            isLoadingRepoFiles: false,
        }));
    }, [session, authIsLoading]);

    useEffect(() => {
        fetchAvailableRepoFiles();
    }, [fetchAvailableRepoFiles]);

    const generateRepomixOutput = useCallback(async (repoUrl: string, include: string, exclude: string): Promise<string | null> => {
        if (!session) {
            setState(prev => ({ ...prev, generationStatus: { message: null, error: "Authentication required." } }));
            return null;
        }
        setState(prev => ({ ...prev, isGenerating: true, generationStatus: { message: `Generating for ${repoUrl}...`, error: null } }));
        if (generationStatusTimer.current) clearTimeout(generationStatusTimer.current);

        const result = await api.runRepomix({ repoUrl, includePatterns: include, excludePatterns: exclude });
        
        if (result.success && result.data?.newFile) {
            const confirmedData = result.data; 
            await fetchAvailableRepoFiles(); // Refresh list first
            setState(prev => ({ // Then update version and other status
                ...prev,
                isGenerating: false,
                generationStatus: { message: confirmedData.message || `Generated ${confirmedData.newFile.filename}`, error: null },
                fileContentVersion: prev.fileContentVersion + 1, // <--- INCREMENT VERSION
            }));
            generationStatusTimer.current = window.setTimeout(clearGenerationStatus, 5000);
            return confirmedData.newFile.filename;
        } else {
            setState(prev => ({
                ...prev,
                isGenerating: false,
                generationStatus: { message: null, error: result.error || "Generation failed." },
            }));
            generationStatusTimer.current = window.setTimeout(clearGenerationStatus, 5000);
            return null;
        }
    }, [session, fetchAvailableRepoFiles, clearGenerationStatus]); // setState implicitly covered by being part of the component

    const deleteRepoFile = useCallback(async (filename: string): Promise<boolean> => {
        // ... (no changes needed here for this specific bug, but ensure it works)
        if (!session) { return false; }
        setState(prev => ({ ...prev, isDeleting: true }));
        const result = await api.deleteGeneratedFile(filename);
        if (result.success) {
            await fetchAvailableRepoFiles();
            if (state.selectedRepoFilename === filename) {
                setState(prev => ({ 
                    ...prev, 
                    selectedRepoFilename: null, 
                    repoUrlForForm: '',
                    fileContentVersion: prev.fileContentVersion + 1 // Increment on delete too, as selected file changes
                }));
            }
        } else {
            console.error("Failed to delete file:", result.error);
            setState(prev => ({ ...prev, repoFilesError: `Failed to delete ${filename}: ${result.error}`}));
        }
        setState(prev => ({ ...prev, isDeleting: false }));
        return result.success;
    }, [session, fetchAvailableRepoFiles, state.selectedRepoFilename]); // Added state.selectedRepoFilename

    const selectRepoFileForProcessing = useCallback((filename: string | null) => {
        // When a new file is selected from the dropdown, this is a distinct event.
        // The App.tsx useEffect will pick up the change in selectedRepoFilename.
        // If the selection itself should imply a "new version" of content to load,
        // you could also increment fileContentVersion here, but typically not needed
        // if selectedRepoFilename is changing to a new string identity.
        // The problem arises when selectedRepoFilename is set to the *same* string again.
        setState(prev => ({ 
            ...prev, 
            selectedRepoFilename: filename, 
            repoFilesError: null,
            // Optionally increment version if selecting the same file means "reload it"
            // fileContentVersion: prev.selectedRepoFilename === filename ? prev.fileContentVersion + 1 : prev.fileContentVersion 
        }));
        if (filename) {
            const repoDetails = parseRepoInfoFromFilename(filename);
            const currentRepo = state.availableRepoFiles.find(r => r.filename === filename);
            if (currentRepo?.repoIdentifier) {
                 const [owner, repoName] = currentRepo.repoIdentifier.split('/');
                 if (owner && repoName) setState(prev => ({ ...prev, repoUrlForForm: `https://github.com/${owner}/${repoName}.git` }));
            } else if (repoDetails) {
                 setState(prev => ({ ...prev, repoUrlForForm: `https://github.com/${repoDetails.owner}/${repoDetails.repoName}.git` }));
            } else {
                 setState(prev => ({ ...prev, repoUrlForForm: '' }));
            }
        } else {
            setState(prev => ({ ...prev, repoUrlForForm: '' }));
        }
    }, [state.availableRepoFiles]);

    return (
        <RepoFileManagerContext.Provider value={{ ...state, fetchAvailableRepoFiles, generateRepomixOutput, deleteRepoFile, selectRepoFileForProcessing, setRepoUrlForForm, clearGenerationStatus }}>
            {children}
        </RepoFileManagerContext.Provider>
    );
};

export const useRepoFileManager = () => { // Ensure this is exported if not already
    const context = useContext(RepoFileManagerContext);
    if (!context) throw new Error('useRepoFileManager must be used within a RepoFileManagerProvider');
    return context;
};