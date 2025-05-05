// src/utils/parseRepomix.ts
export interface ParsedRepomixData {
    directoryStructure: string[];
    fileContents: Record<string, string>; // Map path -> content
}

export function parseRepomixFile(content: string): ParsedRepomixData | null {
    try {
        const structureMatch = content.match(/<directory_structure>\s*([\s\S]*?)\s*<\/directory_structure>/);
        const filesMatch = content.match(/<files>\s*([\s\S]*?)\s*<\/files>/);

        if (!structureMatch || !filesMatch) {
            console.warn("Could not find <directory_structure> or <files> tags.");
            return null; // Not a valid Repomix file structure
        }

        // 1. Parse Directory Structure
        const structureContent = structureMatch[1].trim();
        const directoryStructure = structureContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // 2. Parse File Contents
        const filesContent = filesMatch[1];
        const fileContents: Record<string, string> = {};
        // Regex to find <file path="...">...</file> blocks
        // Using a non-greedy match for the content .*?
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        let fileBlockMatch;

        while ((fileBlockMatch = fileRegex.exec(filesContent)) !== null) {
            const filePath = fileBlockMatch[1];
            // Trim leading/trailing whitespace/newlines from extracted content
            const fileData = fileBlockMatch[2].trim();
            fileContents[filePath] = fileData;
        }

         // Basic validation: Check if any files were actually parsed if the structure wasn't empty
         if (directoryStructure.length > 0 && Object.keys(fileContents).length === 0) {
            console.warn("Directory structure found, but no file contents parsed. Check <file> tags.");
            // Decide if this is an error or just an empty repo case
            // return null; // Or proceed if empty is valid
        }

        console.log(`Parsed Repomix: ${directoryStructure.length} structure entries, ${Object.keys(fileContents).length} files.`);
        return { directoryStructure, fileContents };

    } catch (error) {
        console.error("Error parsing Repomix file content:", error);
        return null;
    }
}