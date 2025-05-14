// // src/hooks/useRepomix.ts
// import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
// import {
//     listGeneratedFiles as apiListGeneratedFiles,
//     getFileContent as apiGetFileContent,
//     runRepomix as apiRunRepomix,
// } from '../services/api';
// import { parseRepomixFile, ParsedRepomixData } from '../utils/parseRepomix';
// import type { RepoInfo } from '../components/RepoSelector';
// import { useAuth } from '../contexts/AuthContext'; // Import useAuth

// const getAllFilePathsFromParsedData = (data: ParsedRepomixData | null): string[] => {
//     if (!data || !data.directoryStructure || !data.fileContents) return [];
//     return data.directoryStructure.filter(p => data.fileContents.hasOwnProperty(p) && !p.endsWith('/'));
// };

// export function useRepomix(initialRepoUrl: string = '') {
//     const { session, isLoading: authIsLoading } = useAuth(); // Get auth state

//     const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
//     const [availableRepos, setAvailableRepos] = useState<RepoInfo[]>([]);
//     const [isLoadingRepos, setIsLoadingRepos] = useState(false); // Start as false
//     const [repoListError, setRepoListError] = useState<string | null>(null);

//     const [selectedRepoFile, setSelectedRepoFile] = useState<string>("");
//     const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
//     const [fileContentError, setFileContentError] = useState<string | null>(null);
    
//     const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
//     const [parsedRepomixData, setParsedRepomixData] = useState<ParsedRepomixData | null>(null);
//     const [selectedFilePathForView, setSelectedFilePathForView] = useState<string | null>(null);
//     const [selectedFileContentForView, setSelectedFileContentForView] = useState<string | null>(null);
//     const [isLoadingSelectedFileForView, setIsLoadingSelectedFileForView] = useState(false);
//     const [promptSelectedFilePaths, setPromptSelectedFilePaths] = useState<string[]>([]);

//     const [isGenerating, setIsGenerating] = useState(false);
//     const [generationMessage, setGenerationMessage] = useState<string | null>(null);
//     const [generationError, setGenerationError] = useState<string | null>(null);
    
//     const [attachmentStatus, setAttachmentStatus] = useState<string | null>(null);
//     const attachmentStatusTimer = useRef<number | null>(null);
//     const justGeneratedFile = useRef<string | null>(null);

//     const clearAttachmentStatus = useCallback(() => {
//         if (attachmentStatusTimer.current) {
//           clearTimeout(attachmentStatusTimer.current);
//           attachmentStatusTimer.current = null;
//         }
//         setAttachmentStatus(null);
//     }, []);

//     const clearFileData = useCallback(() => { 
//         setAttachedFileName(null);
//         setParsedRepomixData(null);
//         setSelectedFilePathForView(null);
//         setPromptSelectedFilePaths([]);
//         setSelectedFileContentForView(null);
//         // Keep selectedRepoFile as is, or clear it based on desired UX
//     }, []);

//     const fetchAvailableRepos = useCallback(async () => {
//         // Only fetch if authenticated and auth process is complete
//         if (!session || authIsLoading) {
//             // console.log('[useRepomix] Skipping fetchAvailableRepos: Not authenticated or auth is loading.');
//             setAvailableRepos([]);
//             setIsLoadingRepos(false);
//             setRepoListError(null);
//             return;
//         }

//         setIsLoadingRepos(true);
//         setRepoListError(null);
//         // console.log('[useRepomix] Fetching available repos...');
//         const result = await apiListGeneratedFiles();
//         if (result.success) {
//             setAvailableRepos(result.data || []);
//         } else {
//             setRepoListError(result.error || "Could not load repo list.");
//             setAvailableRepos([]);
//         }
//         setIsLoadingRepos(false);
//     }, [session, authIsLoading]);

//     useEffect(() => {
//         fetchAvailableRepos();
//     }, [fetchAvailableRepos]);

//     const loadRepoFileContent = useCallback(async (filename: string): Promise<boolean> => {
//         // Auth check implicit because this is usually user-triggered after auth
//         // Or, if it can be triggered programmatically on load, ensure session exists
//         if (!session || authIsLoading) {
//             // console.log('[useRepomix] Skipping loadRepoFileContent: Not authenticated or auth is loading.');
//             clearFileData();
//             setSelectedRepoFile("");
//             setFileContentError("Authentication required to load file content.");
//             return false;
//         }
//         if (!filename) {
//             clearFileData();
//             setSelectedRepoFile("");
//             clearAttachmentStatus();
//             return false;
//         }

//         setIsLoadingFileContent(true);
//         setFileContentError(null);
//         setRepoListError(null); // Clear other errors
//         clearFileData(); // Clear previous file data
//         setSelectedRepoFile(filename);
//         clearAttachmentStatus();
//         setAttachmentStatus(`Attaching ${filename}...`);
        
//         const selectedRepoInfo = availableRepos.find(repo => repo.filename === filename);
//         if (selectedRepoInfo?.repoIdentifier) {
//             setRepoUrl(`https://github.com/${selectedRepoInfo.repoIdentifier}`); // Update repoUrl for context
//         }

//         // console.log(`[useRepomix] Loading content for ${filename}...`);
//         const result = await apiGetFileContent(filename);
//         if (result.success && result.content) {
//             const rawContent = result.content;
//             setAttachedFileName(filename);
//             const parsedData = parseRepomixFile(rawContent);

//             if (parsedData) {
//                 setParsedRepomixData(parsedData);
//                 setAttachmentStatus(`Attached & Parsed ${filename} successfully.`);
//                 setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
//             } else {
//                 setParsedRepomixData(null); // Ensure it's null if parsing fails
//                 setAttachmentStatus(`Attached ${filename} (non-standard format or parse error).`);
//                 setPromptSelectedFilePaths([]);
//             }
//             if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
//             attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 3000);
//             setIsLoadingFileContent(false);
//             return true;
//         } else {
//             setFileContentError(`Failed to load content for ${filename}: ${result.error || 'Unknown error'}`);
//             clearFileData(); // Clear data on failure
//             setSelectedRepoFile(""); // Deselect on failure
//             setAttachmentStatus(`Failed to attach ${filename}.`);
//             if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
//             attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 5000);
//             setIsLoadingFileContent(false);
//             return false;
//         }
//     }, [session, authIsLoading, clearFileData, availableRepos, clearAttachmentStatus]);

//     useEffect(() => {
//         if (justGeneratedFile.current && availableRepos.find(r => r.filename === justGeneratedFile.current)) {
//             const filenameToLoad = justGeneratedFile.current;
//             justGeneratedFile.current = null; 

//             // console.log(`[useRepomix Effect] New file "${filenameToLoad}" detected. Attempting to load.`);
//             (async () => { 
//                 const loaded = await loadRepoFileContent(filenameToLoad);
//                 if (loaded) {
//                     setGenerationMessage(prev => prev ? `${prev} File loaded: ${filenameToLoad}.` : `Generated & Loaded: ${filenameToLoad}.`);
//                 } else {
//                     setGenerationError(prev => prev ? `${prev} Failed to auto-load ${filenameToLoad}.` : `Generated ${filenameToLoad}, but failed to load/parse it. Please try selecting it manually.`);
//                     // setGenerationMessage(null); // Keep existing message if any, just add error
//                 }
//             })();
//         }
//     }, [availableRepos, loadRepoFileContent]);


//     const handleManualFileAttach = useCallback((file: File) => {
//         // No direct auth check needed here as it's a client-side operation before any API call
//         setFileContentError(null);
//         setGenerationMessage(null);
//         setGenerationError(null);
//         clearAttachmentStatus();
//         clearFileData();
//         setSelectedRepoFile(""); // Clear selected repo from dropdown

//         const reader = new FileReader();
//         reader.onload = (event) => {
//             const content = event.target?.result as string;
//             setAttachedFileName(file.name);
//             const parsedData = parseRepomixFile(content);
//             setParsedRepomixData(parsedData);
//             if (parsedData) {
//               setPromptSelectedFilePaths(getAllFilePathsFromParsedData(parsedData));
//               setAttachmentStatus(`Attached & Parsed ${file.name} successfully.`);
//             } else {
//               setPromptSelectedFilePaths([]);
//               setAttachmentStatus(`Attached ${file.name} (non-standard format or parse error).`);
//             }
//             if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
//             attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 3000);
//         };
//         reader.onerror = (err) => {
//             setFileContentError(`Error reading file: ${err}`); // Consider a more specific error state
//             clearFileData();
//             setAttachmentStatus(`Failed to attach ${file.name}.`);
//             if (attachmentStatusTimer.current) clearTimeout(attachmentStatusTimer.current);
//             attachmentStatusTimer.current = window.setTimeout(clearAttachmentStatus, 5000);
//         };
//         reader.readAsText(file);
//     }, [clearFileData, clearAttachmentStatus]);

//     const handleGenerateRepomixFile = useCallback(async (
//         generateRepoUrl: string, includePatterns: string, excludePatterns: string
//     ) => {
//         if (!session || authIsLoading) {
//             // console.log('[useRepomix] Skipping handleGenerateRepomixFile: Not authenticated or auth is loading.');
//             setGenerationError("Authentication required to generate file.");
//             return;
//         }
//         setIsGenerating(true);
//         setGenerationMessage(null);
//         setGenerationError(null);
//         clearFileData(); // Clear previous data before generating new
//         clearAttachmentStatus();
//         setSelectedRepoFile(""); // Deselect any previously selected repo
//         justGeneratedFile.current = null;

//         // console.log(`[useRepomix] Generating Repomix file for ${generateRepoUrl}...`);
//         const result = await apiRunRepomix({ repoUrl: generateRepoUrl, includePatterns, excludePatterns });

//         if (result.success && result.data && result.data.newFile && result.data.newFile.filename) {
//             const outputFilename = result.data.newFile.filename;
//             justGeneratedFile.current = outputFilename;
//             setGenerationMessage(`Success! Output: ${outputFilename}. Refreshing list...`);
//             // Fetching available repos will trigger the useEffect to load the new file
//             await fetchAvailableRepos(); 
//         } else {
//             setGenerationError(result.error || "Repomix finished, but no output filename or an error occurred.");
//             if (result.stderr) console.warn("Repomix stderr:", result.stderr);
//             setGenerationMessage(null); // Clear success message if error
//             justGeneratedFile.current = null;
//         }
//         setIsGenerating(false);
//     }, [session, authIsLoading, clearFileData, fetchAvailableRepos, clearAttachmentStatus]);
    
//     const handleSelectFileForViewing = useCallback((filePath: string) => {
//         if (!parsedRepomixData || !filePath) {
//             setSelectedFilePathForView(null);
//             setSelectedFileContentForView(null);
//             return;
//         }
//         setIsLoadingSelectedFileForView(true);
//         setSelectedFilePathForView(filePath);
//         const content = parsedRepomixData.fileContents[filePath];
//         setSelectedFileContentForView(content !== undefined ? content : `// Error: Content for ${filePath} not found.`);
//         setIsLoadingSelectedFileForView(false);
//     }, [parsedRepomixData]);

//     const handleTogglePromptSelectedFile = useCallback((filePath: string) => {
//         setPromptSelectedFilePaths(prev =>
//             prev.includes(filePath) ? prev.filter(p => p !== filePath) : [...prev, filePath]
//         );
//     }, []);

//     const allFilePathsInCurrentRepomix = useMemo(() => getAllFilePathsFromParsedData(parsedRepomixData), [parsedRepomixData]);

//     const handleSelectAllPromptFiles = useCallback(() => {
//         setPromptSelectedFilePaths([...allFilePathsInCurrentRepomix]);
//     }, [allFilePathsInCurrentRepomix]);

//     const handleDeselectAllPromptFiles = useCallback(() => {
//         setPromptSelectedFilePaths([]);
//     }, []);

//     return {
//         repoUrl,
//         onRepoUrlChange: setRepoUrl,
//         // includePatterns and excludePatterns are managed by RepomixForm, not this hook directly.
//         handleGenerateRepomixFile,
//         isGenerating,
//         generationMessage,
//         generationError,

//         availableRepos,
//         isLoadingRepos,
//         repoListError,
//         selectedRepoFile,
//         loadRepoFileContent,
//         isLoadingFileContent,
//         fileContentError,

//         handleManualFileAttach,
//         attachedFileName,
//         parsedRepomixData,
//         selectedFilePathForView,
//         selectedFileContentForView,
//         isLoadingSelectedFileForView,
//         handleSelectFileForViewing,

//         promptSelectedFilePaths,
//         handleTogglePromptSelectedFile,
//         handleSelectAllPromptFiles,
//         handleDeselectAllPromptFiles,
//         allFilePathsInCurrentRepomix,

//         attachmentStatus,
//     };
// }