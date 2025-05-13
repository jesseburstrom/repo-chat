// src/utils/parseRepomix.ts
export interface ParsedRepomixData {
    directoryStructure: string[]; // This will ALWAYS be a flat list of full file paths
    fileContents: Record<string, string>; // Map path -> content
}

// --- NEW HELPER FUNCTION ---
function parseDirectoryStructure(structureContent: string): string[] {
    const lines = structureContent.trim().split('\n');
    const filePaths: string[] = [];
    const pathStack: string[] = [];
    //let lastIndent = -1;

    // Detect if the format is likely flat (heuristic: check if first non-empty line contains '/' and doesn't end with '/')
    const firstRealLine = lines.find(line => line.trim().length > 0)?.trim();
    const likelyFlat = firstRealLine && firstRealLine.includes('/') && !firstRealLine.endsWith('/');

    if (likelyFlat) {
        // Assume flat format: Just trim and filter valid paths
        // Basic check: Does it look like a path (contains '/' or maybe just a filename)?
        // This might need refinement depending on root-level files.
        // console.log("Detected likely flat directory structure format.");
        return lines
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.endsWith('/')); // Filter out potential empty lines or folders if any mixed in
    } else {
        // Assume indented format or handle mixed cases
        // console.log("Processing potentially indented directory structure format.");
        const INDENT_SIZE = 2; // Assuming 2 spaces for indentation, adjust if needed

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue; // Skip empty lines

            const indentMatch = line.match(/^(\s*)/);
            const currentIndent = indentMatch ? indentMatch[1].length : 0;

            // Determine depth based on indentation (adjust if using tabs or different spacing)
            const currentDepth = Math.floor(currentIndent / INDENT_SIZE);

            // Adjust path stack based on indentation level
            // If indent decreased, pop items from stack
            while (pathStack.length > currentDepth) {
                pathStack.pop();
            }

            if (trimmedLine.endsWith('/')) {
                // It's a directory: push its name onto the stack
                const dirName = trimmedLine.slice(0, -1);
                // Only push if the depth matches the stack length (prevents pushing duplicates if indent is weird)
                if (pathStack.length === currentDepth) {
                     pathStack.push(dirName);
                } else {
                    // Indentation doesn't match expected depth, maybe handle error or warning
                    console.warn(`Indentation mismatch for directory: ${trimmedLine} at indent ${currentIndent}, stack depth ${pathStack.length}`);
                    // Attempt to recover: reset stack to match depth? Or just push?
                    // For now, let's push based on the current stack to avoid breaking too much
                    pathStack.push(dirName);


                }
            } else {
                // It's a file: construct full path and add to results
                const fileName = trimmedLine;
                const prefix = pathStack.join('/');
                const fullPath = prefix ? `${prefix}/${fileName}` : fileName;
                filePaths.push(fullPath);
            }
            //lastIndent = currentIndent; // Remember indent for next line (optional, not used above but could be)
        }
        return filePaths;
    }
}
// --- END HELPER FUNCTION ---

export function parseRepomixFile(content: string): ParsedRepomixData | null {
    try {
        const structureMatch = content.match(/<directory_structure>\s*([\s\S]*?)\s*<\/directory_structure>/);
        const filesMatch = content.match(/<files>\s*([\s\S]*?)\s*<\/files>/);

        if (!structureMatch || !filesMatch) {
            console.warn("Could not find <directory_structure> or <files> tags.");
            return null; // Not a valid Repomix file structure
        }

        // 1. Parse Directory Structure using the new helper
        const structureContent = structureMatch[1]; // Don't trim here, helper needs original spacing
        const directoryStructure = parseDirectoryStructure(structureContent); // <= USE HELPER

        // 2. Parse File Contents
        const filesContent = filesMatch[1];
        const fileContents: Record<string, string> = {};
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        let fileBlockMatch;

        while ((fileBlockMatch = fileRegex.exec(filesContent)) !== null) {
            const filePath = fileBlockMatch[1];
            // Get raw content from between tags. 
            // Line ending normalization will happen in CodePane.
            const fileData = fileBlockMatch[2]; 
            fileContents[filePath] = fileData;
        }

         // Basic validation: Check if parsed files match structure files
         // Note: Structure might only list included files, so lengths may not match exactly
         // if the structure includes files that weren't included in the <files> block.
        if (directoryStructure.length > 0 && Object.keys(fileContents).length === 0) {
            // This might happen if only folders exist or if included files list is empty
            console.warn("Directory structure parsed, but no file contents found in <files> block.");
        }
         if (Object.keys(fileContents).length > 0 && directoryStructure.length === 0) {
             console.warn("File contents found, but directory structure seems empty or failed to parse.");
              // Decide if this is an error
             // return null;
         }


        console.log(`Parsed Repomix: ${directoryStructure.length} structure entries (flat list), ${Object.keys(fileContents).length} files.`);
        return { directoryStructure, fileContents };

    } catch (error) {
        console.error("Error parsing Repomix file content:", error);
        return null;
    }
}