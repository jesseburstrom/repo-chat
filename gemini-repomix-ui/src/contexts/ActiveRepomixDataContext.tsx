// gemini-repomix-ui/src/contexts/ActiveRepomixDataContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import * as api from '../services/api';
import { parseRepomixFile, ParsedRepomixData } from '../utils/parseRepomix';
import { useAuth } from './AuthContext'; // For auth checks if API calls need it

const getAllFilePathsFromParsedData = (data: ParsedRepomixData | null): string[] => {
    if (!data || !data.directoryStructure || !data.fileContents) return [];
    return data.directoryStructure.filter(p => data.fileContents.hasOwnProperty(p) && !p.endsWith('/'));
};

interface ActiveRepomixDataState {
    activeRepomixSource: { type: 'server' | 'manual'; filename: string } | null;
    parsedRepomixData: ParsedRepomixData | null;
    isLoadingData: boolean;
    dataError: string | null;
    attachmentStatus: string | null;
    selectedFilePathForView: string | null;
    selectedFileContentForView: string | null;
    promptSelectedFilePaths: string[];
    allFilePathsInCurrentRepomix: string[];
}

interface ActiveRepomixDataActions {
    loadAndParseDataFromServerFile: (filename: string) => Promise<boolean>;
    loadAndParseDataFromManualFile: (file: File, filename: string) => Promise<boolean>;
    clearActiveData: () => void;
    selectFileForViewing: (filePath: string) => void;
    togglePromptSelectedFile: (filePath: string) => void;
    selectAllPromptFiles: () => void;
    deselectAllPromptFiles: () => void;
    clearAttachmentStatus: () => void;
}

type ActiveRepomixDataContextType = ActiveRepomixDataState & ActiveRepomixDataActions;
const ActiveRepomixDataContext = createContext<ActiveRepomixDataContextType | undefined>(undefined);

export const ActiveRepomixDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { session } = useAuth(); // For API calls that need auth
    const [state, setState] = useState<ActiveRepomixDataState>({
        activeRepomixSource: null,
        parsedRepomixData: null,
        isLoadingData: false,
        dataError: null,
        attachmentStatus: null,
        selectedFilePathForView: null,
        selectedFileContentForView: null,
        promptSelectedFilePaths: [],
        allFilePathsInCurrentRepomix: [],
    });
    const attachmentStatusTimer = useRef<number | null>(null);

    const clearAttachmentStatus = useCallback(() => {
        if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
        setState(prev => ({ ...prev, attachmentStatus: null }));
    }, []);

    const setAttachmentStatusWithTimeout = useCallback((message: string | null, isError: boolean = false, timeout = 3000) => {
        if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
        setState(prev => ({
            ...prev,
            attachmentStatus: message,
            dataError: isError ? (message || prev.dataError) : (prev.dataError) // Only set dataError if isError is true
        }));
        if (message) {
            attachmentStatusTimer.current = window.setTimeout(() => {
                clearAttachmentStatus();
            }, timeout);
        }
    }, [clearAttachmentStatus]);

    const clearActiveData = useCallback(() => {
        setState({
            activeRepomixSource: null,
            parsedRepomixData: null,
            isLoadingData: false,
            dataError: null,
            attachmentStatus: null,
            selectedFilePathForView: null,
            selectedFileContentForView: null,
            promptSelectedFilePaths: [],
            allFilePathsInCurrentRepomix: [],
        });
        clearAttachmentStatus();
    }, [clearAttachmentStatus]);

    const processParsedData = (parsedData: ParsedRepomixData | null, filename: string, type: 'server' | 'manual') => {
        const allPaths = getAllFilePathsFromParsedData(parsedData);
        setState(prev => ({
            ...prev,
            activeRepomixSource: { type, filename },
            parsedRepomixData: parsedData,
            allFilePathsInCurrentRepomix: allPaths,
            promptSelectedFilePaths: allPaths,
            isLoadingData: false,
            dataError: null,
        }));
        setAttachmentStatusWithTimeout(parsedData ? `Attached & Parsed ${filename}` : `Attached ${filename} (non-standard format or parse error)`);
        return !!parsedData;
    };

    const loadAndParseDataFromServerFile = useCallback(async (filename: string): Promise<boolean> => {
        if (!session) {
            clearActiveData();
            setState(prev => ({...prev, dataError: "Authentication required to load server file."}));
            return false;
        }
        clearActiveData(); // Clear previous before loading new
        setState(prev => ({ ...prev, isLoadingData: true, dataError: null }));
        setAttachmentStatusWithTimeout(`Loading ${filename}...`);

        const result = await api.getFileContent(filename);
        if (result.success && result.content) {
            const parsedData = parseRepomixFile(result.content);
            return processParsedData(parsedData, filename, 'server');
        } else {
            setState(prev => ({
                ...prev,
                isLoadingData: false,
                dataError: result.error || `Failed to load ${filename}`,
            }));
            setAttachmentStatusWithTimeout(`Failed to attach ${filename}: ${result.error}`, true, 5000);
            return false;
        }
    }, [session, clearActiveData, setAttachmentStatusWithTimeout]);

    const loadAndParseDataFromManualFile = useCallback(async (file: File, filename: string): Promise<boolean> => {
        clearActiveData();
        setState(prev => ({ ...prev, isLoadingData: true, dataError: null }));
        setAttachmentStatusWithTimeout(`Attaching ${filename}...`);

        return new Promise<boolean>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                const parsedData = parseRepomixFile(content);
                const success = processParsedData(parsedData, filename, 'manual');
                resolve(success);
            };
            reader.onerror = (err) => {
                setState(prev => ({ ...prev, isLoadingData: false, dataError: `Error reading file: ${String(err)}` }));
                setAttachmentStatusWithTimeout(`Failed to attach ${filename}.`, true, 5000);
                resolve(false);
            };
            reader.readAsText(file);
        });
    }, [clearActiveData, setAttachmentStatusWithTimeout]);


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
        <ActiveRepomixDataContext.Provider value={{
            ...state,
            loadAndParseDataFromServerFile,
            loadAndParseDataFromManualFile,
            clearActiveData,
            selectFileForViewing,
            togglePromptSelectedFile,
            selectAllPromptFiles,
            deselectAllPromptFiles,
            clearAttachmentStatus,
        }}>
            {children}
        </ActiveRepomixDataContext.Provider>
    );
};

export const useActiveRepomixData = () => {
    const context = useContext(ActiveRepomixDataContext);
    if (!context) throw new Error('useActiveRepomixData must be used within an ActiveRepomixDataProvider');
    return context;
};