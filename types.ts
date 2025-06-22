
export type Theme = 'dark'; // Light mode removed

export interface ServiceStatus {
  gemini: boolean;
  gitlab: string; // e.g., "Disconnected", "Connecting...", "Connected to https://gitlab.com", "Connection Failed"
  bigQuery: string; // Simplified for frontend
}

// Stricter typing for known languages, but allow any string for flexibility
export type IdentifiedLanguage = 
  | 'python' | 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'yaml' 
  | 'java' | 'csharp' | 'c#' | 'cpp' | 'c++' | 'go' | 'ruby' | 'php' | 'swift' 
  | 'kotlin' | 'rust' | 'markdown' | 'shell' | 'bash' | 'sql' | 'xml' 
  | 'other' | string;


export interface Suggestion {
  description: string;
  fix_prompt: string; // A prompt for the user/AI to fix this
}

export interface AnalysisData {
  language?: IdentifiedLanguage;
  breakdown: string;
  suggestions: Suggestion[];
}

export interface ChatMessage {
  sender: 'user' | 'gemini';
  text: string;
  timestamp?: Date;
  fileOperations?: FileOperation[]; // For AI suggested file changes
}

export interface GroundingChunk {
  web?: {
    uri?: string; 
    title?: string; 
  };
  retrievedContext?: { 
    uri?: string; 
    title?: string; 
  };
}

export interface SearchResult {
  id: string;
  title: string;
  link?: string; 
  summary: string; 
  score?: number; 
  type: 'stackoverflow' | 'documentation';
  source: string; 
  groundingChunks?: GroundingChunk[]; 
}

export type TabKey = 'dashboard' | 'project' | 'analysis' | 'chat' | 'gitlab' | 'cloud_search';

export interface ProjectFile {
  path: string; // Full path relative to project root, e.g., "src/components/Button.tsx" or "src/" for a folder
  content: string; // File content, or empty for folders
  type: 'file' | 'folder';
  lastModified?: number; // Timestamp of last modification
}

export type FileAction = 'createFile' | 'updateFile' | 'deleteFile' | 'createDirectory';

export interface FileOperation {
  action: FileAction;
  path: string;
  content?: string; // For createFile and updateFile
}