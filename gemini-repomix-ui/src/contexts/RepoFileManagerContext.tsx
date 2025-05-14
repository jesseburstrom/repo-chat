// gemini-repomix-ui/src/contexts/RepoFileManagerContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import * as api from '../services/api';
import type { RepoInfo } from '../components/RepoSelector'; // Assuming this path is correct
import { useAuth } from './AuthContext';
import { parseRepoInfoFromFilename } from '../utils/filenameUtils';

interface RepoFileManagerState {
    availableRepoFiles: RepoInfo[];
    isLoadingRepoFiles: boolean;
    repoFilesError: string | null;
    isGenerating: boolean;
    generationStatus: { message: string | null; error: string | null };
    isDeleting: boolean; // Added for delete operation
    selectedRepoFilename: string | null;
    repoUrlForForm: string;
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
        
        // Check if result.success is true and result.data and result.data.newFile are present
        if (result.success && result.data && result.data.newFile) {
            // Assign result.data to a new const to help TypeScript with type narrowing.
            const confirmedData = result.data; 
            
            setState(prev => ({
                ...prev,
                isGenerating: false,
                // Use the new 'confirmedData' const which should have the narrowed type.
                generationStatus: { message: confirmedData.message || `Generated ${confirmedData.newFile.filename}`, error: null },
            }));
            await fetchAvailableRepoFiles(); // Refresh list
            generationStatusTimer.current = window.setTimeout(clearGenerationStatus, 5000);
            // Use confirmedData here as well.
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
    }, [session, fetchAvailableRepoFiles, clearGenerationStatus]);

    const deleteRepoFile = useCallback(async (filename: string): Promise<boolean> => {
        if (!session) {
             // Handle auth error if needed, or rely on API layer
            return false;
        }
        setState(prev => ({ ...prev, isDeleting: true }));
        const result = await api.deleteGeneratedFile(filename);
        if (result.success) {
            await fetchAvailableRepoFiles();
            if (state.selectedRepoFilename === filename) {
                setState(prev => ({ ...prev, selectedRepoFilename: null, repoUrlForForm: '' }));
            }
        } else {
            console.error("Failed to delete file:", result.error);
            // Optionally set an error message in state for the UI
            setState(prev => ({ ...prev, repoFilesError: `Failed to delete ${filename}: ${result.error}`}));
        }
        setState(prev => ({ ...prev, isDeleting: false }));
        return result.success;
    }, [session, fetchAvailableRepoFiles, state.selectedRepoFilename]);

    const selectRepoFileForProcessing = useCallback((filename: string | null) => {
        setState(prev => ({ ...prev, selectedRepoFilename: filename, repoFilesError: null })); // Clear errors on new selection
        if (filename) {
            const repoDetails = parseRepoInfoFromFilename(filename);
            const currentRepo = state.availableRepoFiles.find(r => r.filename === filename);
            if (currentRepo && repoDetails) {
                // Ensure the repoIdentifier from the list is prioritized if available for URL construction
                // Assuming repoIdentifier is "owner/repo"
                const [owner, repoName] = currentRepo.repoIdentifier.split('/');
                if (owner && repoName) {
                    setState(prev => ({ ...prev, repoUrlForForm: `https://github.com/${owner}/${repoName}.git` }));
                } else {
                     setState(prev => ({ ...prev, repoUrlForForm: `https://github.com/${repoDetails.owner}/${repoDetails.repoName}.git` }));
                }
            } else if (repoDetails) { // Fallback to parsing from filename if not in available list (shouldn't happen ideally)
                 setState(prev => ({ ...prev, repoUrlForForm: `https://github.com/${repoDetails.owner}/${repoDetails.repoName}.git` }));
            }
             else {
                 setState(prev => ({ ...prev, repoUrlForForm: '' }));
            }
        } else {
            setState(prev => ({ ...prev, repoUrlForForm: '' }));
        }
    }, [state.availableRepoFiles]); // Added availableRepoFiles dependency

    return (
        <RepoFileManagerContext.Provider value={{ ...state, fetchAvailableRepoFiles, generateRepomixOutput, deleteRepoFile, selectRepoFileForProcessing, setRepoUrlForForm, clearGenerationStatus }}>
            {children}
        </RepoFileManagerContext.Provider>
    );
};

export const useRepoFileManager = () => {
    const context = useContext(RepoFileManagerContext);
    if (!context) throw new Error('useRepoFileManager must be used within a RepoFileManagerProvider');
    return context;
};