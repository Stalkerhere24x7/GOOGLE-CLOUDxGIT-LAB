
import { ProjectFile, FileOperation } from './types';

// Extracts a JSON object from a string, attempting to find it even if wrapped in markdown or other text.
export const extractJsonFromText = (text: string): any | null => {
  if (!text) return null;
  
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  const firstBracket = jsonStr.indexOf('[');
  const lastBracket = jsonStr.lastIndexOf(']');

  let potentialJson = "";

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    // It's likely an object
    potentialJson = jsonStr.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    // It's likely an array
    potentialJson = jsonStr.substring(firstBracket, lastBracket + 1);
  } else {
    return null;
  }

  try {
    const parsed = JSON.parse(potentialJson);
    // Check for our specific fileOperations structure
    if (parsed && typeof parsed === 'object' && parsed.hasOwnProperty('fileOperations')) {
        return parsed as { fileOperations: FileOperation[] };
    }
    return parsed;
  } catch (e) {
    // console.warn("Failed to parse extracted JSON:", e, potentialJson);
    return null;
  }
};


// Cleans up code responses from AI, removing markdown fences.
export const cleanupCode = (text: string): string => {
  if (!text) return "";
  let lines = text.trim().split('\\n');
  if (lines.length <=1 ) lines = text.trim().split('\n');

  if (lines.length > 0 && lines[0].match(/^```(\w*)/)) {
    lines.shift();
  }
  if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
    lines.pop();
  }
  return lines.join('\n');
};

// Parses a simple text-based directory structure into ProjectFile objects.
export const parseDirectoryStructure = (text: string, existingFiles: ProjectFile[] = []): ProjectFile[] => {
  const files: ProjectFile[] = [...existingFiles];
  let lines = text.split('\\n').map(line => line.trimEnd()); // Handle escaped newlines and trim trailing spaces
  if (lines.length <=1 && text.includes('\n')) lines = text.split('\n').map(line => line.trimEnd());


  const pathStack: string[] = [];

  const getFullPath = (name: string): string => {
    return (pathStack.join('') + name).replace(/\/+/g, '/');
  };
  
  const addFileOrFolder = (path: string, type: 'file' | 'folder', content: string = '') => {
    const existingIndex = files.findIndex(f => f.path === path);
    if (existingIndex !== -1) {
      if (files[existingIndex].type === 'folder' && type === 'file') { // A folder path was abstractly created, now a file is specified
        files[existingIndex].type = 'file';
        files[existingIndex].content = content;
        files[existingIndex].lastModified = Date.now();
      } else if (type === 'file') { // Overwrite existing file
        files[existingIndex].content = content;
        files[existingIndex].lastModified = Date.now();
      }
      // If types match or trying to overwrite file with folder, do nothing to existing
    } else {
      files.push({ path, type, content, lastModified: Date.now() });
    }
  };


  for (const line of lines) {
    if (!line.trim()) continue;

    const leadingSpaces = line.match(/^(\s*)/)?.[0].length || 0;
    const name = line.trim();
    const level = Math.floor(leadingSpaces / 2); // Assuming 2 spaces per indent level

    while (level < pathStack.length) {
      pathStack.pop();
    }

    if (name.endsWith('/')) { // It's a directory
      const dirName = name;
      const fullPath = getFullPath(dirName);
      addFileOrFolder(fullPath, 'folder');
      pathStack.push(dirName);
    } else { // It's a file
      const fileName = name;
      const fullPath = getFullPath(fileName);
      addFileOrFolder(fullPath, 'file', `// ${fileName} - created from structure`);
      // Ensure parent directories exist
      const parentPathParts = fullPath.split('/');
      parentPathParts.pop(); // remove filename
      let currentParentPath = '';
      for (const part of parentPathParts) {
        if (!part) continue;
        currentParentPath += part + '/';
        if (!files.some(f => f.path === currentParentPath && f.type === 'folder')) {
          addFileOrFolder(currentParentPath, 'folder');
        }
      }
    }
  }
  // Deduplicate and ensure folder entries are present if files imply them
  const finalFiles: ProjectFile[] = [];
  const paths = new Set<string>();
  files.sort((a,b) => a.path.localeCompare(b.path)); // Sort to process folders first generally

  for (const file of files) {
      if (!paths.has(file.path)) {
          finalFiles.push(file);
          paths.add(file.path);

          // Ensure parent directories exist
          if (file.type === 'file') {
              const parts = file.path.split('/');
              let currentPath = '';
              for (let i = 0; i < parts.length - 1; i++) {
                  currentPath += parts[i] + '/';
                  if (!paths.has(currentPath)) {
                      finalFiles.push({ path: currentPath, type: 'folder', content: '', lastModified: Date.now() });
                      paths.add(currentPath);
                  }
              }
          }
      } else if (file.type === 'file' && finalFiles.find(f => f.path === file.path)?.type === 'folder') {
          // If a folder was added and now a file with same path is encountered, update type and content
          const existing = finalFiles.find(f => f.path === file.path);
          if (existing) {
              existing.type = 'file';
              existing.content = file.content;
              existing.lastModified = file.lastModified;
          }
      }
  }
  
  // Sort again for consistent order
  return finalFiles.sort((a,b) => a.path.localeCompare(b.path));
};