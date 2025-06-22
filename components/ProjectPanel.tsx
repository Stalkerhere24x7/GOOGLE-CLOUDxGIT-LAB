
import React, { useState, useCallback } from 'react';
import { ProjectFile, FileOperation, ChatMessage } from '../types';
import { GoogleGenAI, Chat } from "@google/genai";
import { Button } from './common/Button';
import { TextArea } from './common/TextInput';
import { parseDirectoryStructure, extractJsonFromText } from '../utils/textUtils';
import { GEMINI_MODEL_TEXT } from '../constants';

interface ProjectPanelProps {
  projectFiles: ProjectFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  setProjectFiles: React.Dispatch<React.SetStateAction<ProjectFile[]>>;
  ai: GoogleGenAI | null;
  updateStatusBar: (message: string, duration?: number) => void;
  setLoadingState: (key: string, value: boolean) => void;
  isLoading: {[key: string]: boolean}; // Added to access App's loading state
  applyFileOperations: (operations: FileOperation[]) => void;
  // Props for AI file scaffolding via chat
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeChatSession: Chat | null;
  setActiveChatSession: React.Dispatch<React.SetStateAction<Chat | null>>;
  projectContext: string;
  currentCode: string;
  identifiedLanguage: string;
}

const FileSystemNavigator: React.FC<{
  files: ProjectFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  level?: number;
  currentPathPrefix?: string;
}> = ({ files, activeFilePath, onFileSelect, level = 0, currentPathPrefix = "" }) => {
  
  const directChildren = files.filter(file => {
    const relativePath = file.path.startsWith(currentPathPrefix) ? file.path.substring(currentPathPrefix.length) : file.path;
    return !relativePath.includes('/') || (relativePath.endsWith('/') && relativePath.split('/').length === 2);
  }).sort((a,b) => { // Folders first, then by name
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.path.localeCompare(b.path);
  });

  if (!directChildren.length && level === 0 && files.length > 0 && currentPathPrefix === "") {
    // Fallback for flat list if no top-level folders
     return (
      <ul className="space-y-1">
        {files.map(file => (
          <li key={file.path} style={{ paddingLeft: `${level * 1}rem` }}>
            <button
              onClick={() => onFileSelect(file.path)}
              className={`w-full text-left px-2 py-1 rounded text-sm flex items-center
                ${activeFilePath === file.path ? 'bg-light-accent text-light-accent_fg dark:bg-dark-accent dark:text-dark-accent_fg' : 'hover:bg-light-select_bg dark:hover:bg-dark-select_bg'}`}
              aria-current={activeFilePath === file.path ? "page" : undefined}
            >
              <i className={`ph-${file.type === 'folder' ? 'folder' : 'file'} ph-fill mr-2`}></i>
              {file.path.substring(currentPathPrefix.length)}
            </button>
          </li>
        ))}
      </ul>
    );
  }


  return (
    <ul className="space-y-1">
      {directChildren.map(file => {
        const relativePath = file.path.startsWith(currentPathPrefix) ? file.path.substring(currentPathPrefix.length) : file.path;
        return (
          <li key={file.path} style={{ paddingLeft: `${level * 1}rem` }}>
            {file.type === 'file' ? (
              <button
                onClick={() => onFileSelect(file.path)}
                className={`w-full text-left px-2 py-1 rounded text-sm flex items-center
                  ${activeFilePath === file.path ? 'bg-light-accent text-light-accent_fg dark:bg-dark-accent dark:text-dark-accent_fg' : 'hover:bg-light-select_bg dark:hover:bg-dark-select_bg'}`}
                aria-current={activeFilePath === file.path ? "page" : undefined}
              >
                <i className="ph-file ph-fill mr-2"></i>
                {relativePath}
              </button>
            ) : ( // Folder
              <div>
                <div className={`w-full text-left px-2 py-1 rounded text-sm flex items-center ${activeFilePath === file.path ? 'font-semibold' : ''}`}>
                  <i className="ph-folder ph-fill mr-2"></i>
                  {relativePath}
                </div>
                <FileSystemNavigator
                  files={files.filter(f => f.path.startsWith(file.path) && f.path !== file.path)}
                  activeFilePath={activeFilePath}
                  onFileSelect={onFileSelect}
                  level={level + 1}
                  currentPathPrefix={file.path}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};


export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projectFiles,
  activeFilePath,
  onFileSelect,
  setProjectFiles,
  ai,
  updateStatusBar,
  setLoadingState,
  isLoading, // Destructured for use
  applyFileOperations,
  // Chat props for AI scaffolding
  chatHistory, setChatHistory, activeChatSession, setActiveChatSession,
  projectContext, currentCode, identifiedLanguage
}) => {
  const [structureText, setStructureText] = useState('');
  const [scaffoldPrompt, setScaffoldPrompt] = useState('');


  const handleCreateStructure = () => {
    if (!structureText.trim()) {
      updateStatusBar('Structure text is empty.', 3000);
      return;
    }
    try {
      const newFiles = parseDirectoryStructure(structureText);
      // Merge with existing, careful not to lose content of existing files if only structure is pasted
      setProjectFiles(prevFiles => {
        const combined = [...prevFiles];
        newFiles.forEach(nf => {
          const existingIdx = combined.findIndex(ef => ef.path === nf.path);
          if (existingIdx !== -1) {
            // If new file is a folder and existing is file, or vice versa, prioritize new structure
            // For now, simple overwrite for structure, but keep content if possible.
             if (combined[existingIdx].type !== nf.type || nf.type === 'folder') { // if type changes or new is folder
                combined[existingIdx].type = nf.type;
             }
             if (nf.type === 'file' && combined[existingIdx].content === '') { // if existing content was placeholder
                combined[existingIdx].content = nf.content;
             }
          } else {
            combined.push(nf);
          }
        });
         return combined.sort((a,b) => a.path.localeCompare(b.path));;
      });
      updateStatusBar('Project structure updated.', 3000);
      setStructureText('');
    } catch (error: any) {
      console.error("Error parsing structure:", error);
      updateStatusBar(`Error parsing structure: ${error.message}`, 5000);
    }
  };
  
  const handleAiScaffold = useCallback(async () => {
    if (!ai || !scaffoldPrompt.trim()) {
        updateStatusBar("AI or prompt is not available.", 3000);
        return;
    }
    setLoadingState('aiScaffold', true);
    updateStatusBar('Asking AI to scaffold project/files...');

    // Use existing chat session or create a new one for this specific task
    let chat = activeChatSession;
    if (!chat) {
        chat = ai.chats.create({
            model: GEMINI_MODEL_TEXT,
            config: { systemInstruction: `You are CodeWeaver AI, a helpful coding assistant. Project context: ${projectContext}. Current active file: ${activeFilePath || 'none'}. Current code language: ${identifiedLanguage}. User's current active file code (first 1000 chars):\n${currentCode.substring(0,1000)}\n\nIMPORTANT: If you need to suggest creating, updating, or deleting files, or creating directories, respond ONLY with a JSON object in the following format: { "fileOperations": [ { "action": "createFile" | "updateFile" | "deleteFile", "path": "path/to/file.ext", "content": "file content (omit for deleteFile)" }, { "action": "createDirectory", "path": "path/to/directory/" } ] }. Ensure paths are relative to the project root. For any other chat, respond normally.` }
        });
        setActiveChatSession(chat);
    }
    
    setChatHistory(prev => [...prev, { sender: 'user', text: `Scaffold request: ${scaffoldPrompt}`, timestamp: new Date() }]);

    try {
        const response = await chat.sendMessage({ message: scaffoldPrompt });
        const responseText = response.text;
        const potentialJson = extractJsonFromText(responseText);

        if (potentialJson && potentialJson.fileOperations && Array.isArray(potentialJson.fileOperations)) {
            applyFileOperations(potentialJson.fileOperations as FileOperation[]);
            setChatHistory(prev => [...prev, { sender: 'gemini', text: "AI processed file scaffolding request. Check changes.", timestamp: new Date(), fileOperations: potentialJson.fileOperations }]);
            updateStatusBar('AI performed file scaffolding operations.', 3000);
        } else {
            setChatHistory(prev => [...prev, { sender: 'gemini', text: `AI response (not file operations): ${responseText}`, timestamp: new Date() }]);
            updateStatusBar('AI responded. See chat if operations were not performed.', 3000);
        }
        setScaffoldPrompt('');
    } catch (error: any) {
        console.error("Error with AI scaffolding:", error);
        setChatHistory(prev => [...prev, { sender: 'gemini', text: `Error during AI scaffolding: ${error.message}`, timestamp: new Date() }]);
        updateStatusBar(`AI scaffolding error: ${error.message}`, 5000);
    } finally {
        setLoadingState('aiScaffold', false);
    }
  }, [ai, scaffoldPrompt, activeChatSession, setActiveChatSession, projectContext, activeFilePath, identifiedLanguage, currentCode, applyFileOperations, setLoadingState, updateStatusBar, setChatHistory]);


  return (
    <div className="space-y-4 p-1 h-full flex flex-col">
      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">Project Files</h3>
        <div className="max-h-60 overflow-y-auto p-2 border border-light-border dark:border-dark-border rounded bg-light-bg dark:bg-dark-bg">
          {projectFiles.length > 0 ? (
            <FileSystemNavigator files={projectFiles} activeFilePath={activeFilePath} onFileSelect={onFileSelect} />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No files in project. Create structure below or use AI.</p>
          )}
        </div>
      </section>

      <section className="flex-grow flex flex-col space-y-4">
        <div>
            <h3 className="text-md font-semibold mb-1 text-light-fg dark:text-dark-fg">Create Structure from Text</h3>
            <TextArea
            value={structureText}
            onChange={(e) => setStructureText(e.target.value)}
            rows={4}
            placeholder={`Example:\nsrc/\n  app.js\n  styles.css\nindex.html\nREADME.md`}
            className="text-sm font-mono"
            aria-label="Paste directory structure text"
            />
            <Button onClick={handleCreateStructure} size="sm" variant="secondary" className="mt-2" icon={<i className="ph-list-plus ph-fill"></i>}>
            Create/Update Structure
            </Button>
        </div>
        
        <div>
            <h3 className="text-md font-semibold mb-1 text-light-fg dark:text-dark-fg">AI Project Scaffolding</h3>
             <TextArea
                value={scaffoldPrompt}
                onChange={(e) => setScaffoldPrompt(e.target.value)}
                rows={3}
                placeholder="e.g., Create a React component named 'Button.tsx' in 'src/components/' with basic button code. Also, create a 'src/utils/helpers.js' file."
                className="text-sm"
                aria-label="AI Scaffolding Prompt"
            />
            <Button onClick={handleAiScaffold} isLoading={!!isLoading['aiScaffold']} size="sm" variant="secondary" className="mt-2" icon={<i className="ph-robot ph-fill"></i>}>
                Ask AI to Scaffold
            </Button>
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                AI will attempt to create/update files based on your prompt. Results will also appear in Co-Coding Chat.
            </p>
        </div>
      </section>
    </div>
  );
};