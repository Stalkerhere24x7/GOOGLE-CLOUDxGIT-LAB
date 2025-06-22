
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { CodeEditor } from './components/CodeEditor';
import { DashboardPanel } from './components/DashboardPanel';
import { AnalysisPanel, AnalysisData } from './components/AnalysisPanel';
import { ChatPanel, ChatMessage } from './components/ChatPanel';
import { GitLabPanel } from './components/GitLabPanel';
import { CloudSearchPanel } from './components/CloudSearchPanel';
import { ProjectPanel } from './components/ProjectPanel'; // New Project Panel
import { ServiceStatus, IdentifiedLanguage, TabKey, Suggestion, SearchResult, ProjectFile, FileOperation } from './types';
import { DEFAULT_PROJECT_FILES, GEMINI_MODEL_TEXT, INITIAL_PROJECT_CONTEXT } from './constants';
import { extractJsonFromText, cleanupCode } from './utils/textUtils';

const API_KEY = process.env.API_KEY;

const App: React.FC = () => {
  // Theme state removed, dark mode is default
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(DEFAULT_PROJECT_FILES);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(
    DEFAULT_PROJECT_FILES.find(f => f.type === 'file')?.path || null
  );
  const [originalCodeForFile, setOriginalCodeForFile] = useState<{ [path: string]: string }>({});
  
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const [statusBarMessage, setStatusBarMessage] = useState<string>('Ready.');
  
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [directEditMode, setDirectEditMode] = useState<boolean>(false);
  const [activeChatSession, setActiveChatSession] = useState<Chat | null>(null);

  const [projectContext, setProjectContext] = useState<string>(INITIAL_PROJECT_CONTEXT);
  const [identifiedLanguage, setIdentifiedLanguage] = useState<IdentifiedLanguage>('html'); // Default based on index.html
  
  const [isGitLabConnected, setIsGitLabConnected] = useState<boolean>(false);
  const [lastPushedGitLabUrl, setLastPushedGitLabUrl] = useState<string | null>(null);
  
  const [gitlabFilePath, setGitlabFilePath] = useState<string>(activeFilePath || 'src/app/main.py');
  const [gitlabBranch, setGitlabBranch] = useState<string>('main');
  const [gitlabCommitMessage, setGitlabCommitMessage] = useState<string>('[AI] Update code via CodeWeaver');

  const [cloudSearchResults, setCloudSearchResults] = useState<SearchResult[]>([]);

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    gemini: false,
    gitlab: 'Disconnected',
    bigQuery: 'Unavailable (Client-side: requires backend)', // Updated explanation
  });

  const currentCode = useMemo(() => {
    if (!activeFilePath) return "";
    const activeFile = projectFiles.find(f => f.path === activeFilePath);
    return activeFile?.content || "";
  }, [projectFiles, activeFilePath]);

  const setCurrentCodeForActiveFile = useCallback((newCode: string) => {
    if (!activeFilePath) return;
    setProjectFiles(prevFiles => 
      prevFiles.map(file => 
        file.path === activeFilePath ? { ...file, content: newCode, lastModified: Date.now() } : file
      )
    );
  }, [activeFilePath]);

  useEffect(() => {
    // Set dark mode on initial load and ensure it stays
    document.documentElement.classList.add('dark');
  }, []);

  const updateStatusBar = (message: string, duration: number = 5000) => {
    setStatusBarMessage(message);
    if (duration > 0) {
      setTimeout(() => setStatusBarMessage('Ready.'), duration);
    }
  };
  
  const setLoadingState = (key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (API_KEY) {
      try {
        const genAI = new GoogleGenAI({ apiKey: API_KEY });
        setAi(genAI);
        setServiceStatus(prev => ({ ...prev, gemini: true }));
        updateStatusBar('Gemini AI Initialized.', 3000);
      } catch (error) {
        console.error("Failed to initialize Gemini AI:", error);
        updateStatusBar('Gemini AI Initialization Failed.', 0);
      }
    } else {
      updateStatusBar('Gemini API Key not found. AI features disabled.', 0);
    }
  }, []);

  useEffect(() => {
    if (activeFilePath) {
      const extension = activeFilePath.split('.').pop()?.toLowerCase();
      const langMap: { [key: string]: IdentifiedLanguage } = {
        'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'html': 'html', 'htm': 'html',
        'css': 'css', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown',
        'java': 'java', 'cs': 'csharp', 'cpp': 'cpp', 'go': 'go', 'rb': 'ruby',
        'php': 'php', 'swift': 'swift', 'kt': 'kotlin', 'rs': 'rust', 'sh': 'shell', 'sql': 'sql', 'xml': 'xml'
      };
      setIdentifiedLanguage(langMap[extension || ''] || 'other');
      setGitlabFilePath(activeFilePath); // Keep GitLab panel's file path in sync
    }
  }, [activeFilePath]);

  const handleAnalyzeCode = useCallback(async () => {
    if (!ai || !activeFilePath) return;
    setLoadingState('analyze', true);
    updateStatusBar(`Analyzing ${activeFilePath} with Gemini...`);
    setAnalysisResult(null);
    setActiveTab('analysis');

    const prompt = `Analyze this code. Determine its primary programming language. Respond with a minified JSON: {"language": "detected_language_string_lowercase", "breakdown": "string (brief summary of code purpose and structure)", "suggestions": [{"description": "string (actionable improvement idea)", "fix_prompt": "string (a prompt for an AI to apply this fix, e.g., 'Refactor this to use a list comprehension')"}]}. Code: \`\`\`\n${currentCode}\n\`\`\``;
    
    try {
      const response = await ai.models.generateContent({ model: GEMINI_MODEL_TEXT, contents: prompt});
      const parsedJson = extractJsonFromText(response.text) as AnalysisData | null; // Cast to expected type
      if (parsedJson) {
        setAnalysisResult(parsedJson);
        if (parsedJson.language && parsedJson.language.trim() !== '' && parsedJson.language !== 'other') {
          setIdentifiedLanguage(parsedJson.language);
          updateStatusBar(`Analysis complete. Language: ${parsedJson.language}.`, 3000);
        } else {
           setIdentifiedLanguage(prev => parsedJson.language || prev);
           updateStatusBar(`Analysis complete. Detected language: ${parsedJson.language || 'ambiguous'}.`, 3000);
        }
      } else {
        throw new Error("AI returned invalid JSON for analysis.");
      }
    } catch (error: any) {
      console.error("Error analyzing code:", error);
      setAnalysisResult({ breakdown: `Error: ${error.message}`, suggestions: [], language: identifiedLanguage });
      updateStatusBar('Analysis failed.', 3000);
    } finally {
      setLoadingState('analyze', false);
    }
  }, [ai, activeFilePath, currentCode, identifiedLanguage]);

  const handleApplyGeminiChanges = useCallback(() => {
    if (!activeFilePath) return;
    setOriginalCodeForFile(prev => {
      const newState = {...prev};
      delete newState[activeFilePath];
      return newState;
    });
    updateStatusBar(`Changes applied to ${activeFilePath}.`, 3000);
  }, [activeFilePath]);

  const handleDiscardGeminiChanges = useCallback(() => {
    if (!activeFilePath || originalCodeForFile[activeFilePath] === undefined) return;
    setCurrentCodeForActiveFile(originalCodeForFile[activeFilePath]!);
    setOriginalCodeForFile(prev => {
      const newState = {...prev};
      delete newState[activeFilePath];
      return newState;
    });
    updateStatusBar(`Changes discarded for ${activeFilePath}.`, 3000);
  }, [activeFilePath, originalCodeForFile, setCurrentCodeForActiveFile]);

  const applyFileOperations = useCallback((operations: FileOperation[]) => {
    setProjectFiles(prevFiles => {
      let updatedFiles = [...prevFiles];
      for (const op of operations) {
        const path = op.path.startsWith('/') ? op.path.substring(1) : op.path; // Normalize path
        const existingFileIndex = updatedFiles.findIndex(f => f.path === path);

        switch (op.action) {
          case 'createFile':
          case 'updateFile':
            if (op.content === undefined) {
              updateStatusBar(`Error: Content missing for ${op.action} on ${path}`, 0);
              continue;
            }
            if (existingFileIndex !== -1) {
              updatedFiles[existingFileIndex] = { ...updatedFiles[existingFileIndex], content: op.content, type: 'file', lastModified: Date.now() };
            } else {
              updatedFiles.push({ path, content: op.content, type: 'file', lastModified: Date.now() });
            }
            // Ensure parent directories exist
            const parentPathParts = path.split('/');
            parentPathParts.pop();
            let currentParentPath = '';
            for (const part of parentPathParts) {
                if (!part) continue;
                currentParentPath += part + '/';
                if (!updatedFiles.some(f => f.path === currentParentPath && f.type === 'folder')) {
                    updatedFiles.push({ path: currentParentPath, type: 'folder', content: '', lastModified: Date.now() });
                }
            }
            updateStatusBar(`${op.action === 'createFile' ? 'Created' : 'Updated'} file: ${path}`, 3000);
            if (op.action === 'createFile') setActiveFilePath(path); // Auto-open newly created file
            break;
          case 'deleteFile':
            if (existingFileIndex !== -1) {
              updatedFiles.splice(existingFileIndex, 1);
              updateStatusBar(`Deleted file: ${path}`, 3000);
              if (activeFilePath === path) setActiveFilePath(null);
            }
            break;
          case 'createDirectory':
             if (existingFileIndex === -1) {
                updatedFiles.push({ path: path.endsWith('/') ? path : path + '/', type: 'folder', content: '', lastModified: Date.now() });
                updateStatusBar(`Created directory: ${path}`, 3000);
             } else if (updatedFiles[existingFileIndex].type === 'file') {
                updateStatusBar(`Error: Cannot create directory, file exists at ${path}`, 0);
             }
             break;
        }
      }
      // Sort files for consistent display (folders first, then by path)
      return updatedFiles.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.path.localeCompare(b.path);
      });
    });
  }, [activeFilePath]);

  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!ai) return;
    setLoadingState('chat', true);
    updateStatusBar('Sending message to Gemini...');
    setChatHistory(prev => [...prev, { sender: 'user', text: message, timestamp: new Date() }]);
    setActiveTab('chat');

    let currentChat = activeChatSession;
    if (!currentChat) {
      currentChat = ai.chats.create({
        model: GEMINI_MODEL_TEXT,
        config: { systemInstruction: `You are CodeWeaver AI, a helpful coding assistant. Project context: ${projectContext}. Current active file: ${activeFilePath || 'none'}. Current code language: ${identifiedLanguage}. User's current active file code (first 1000 chars):\n${currentCode.substring(0,1000)}\n\nIMPORTANT: If you need to suggest creating, updating, or deleting files, or creating directories, respond ONLY with a JSON object in the following format: { "fileOperations": [ { "action": "createFile" | "updateFile" | "deleteFile", "path": "path/to/file.ext", "content": "file content (omit for deleteFile)" }, { "action": "createDirectory", "path": "path/to/directory/" } ] }. Ensure paths are relative to the project root. For any other chat, respond normally.` }
      });
      setActiveChatSession(currentChat);
    }
    
    try {
      const response: GenerateContentResponse = await currentChat.sendMessage({ message });
      const responseText = response.text;
      const potentialJson = extractJsonFromText(responseText);
      
      if (potentialJson && potentialJson.fileOperations && Array.isArray(potentialJson.fileOperations)) {
        applyFileOperations(potentialJson.fileOperations as FileOperation[]);
        setChatHistory(prev => [...prev, { sender: 'gemini', text: "I've processed the file operations. Check the Project panel.", timestamp: new Date(), fileOperations: potentialJson.fileOperations }]);
        updateStatusBar('Gemini performed file operations.', 3000);
      } else if (directEditMode && activeFilePath) {
        setOriginalCodeForFile(prev => ({...prev, [activeFilePath]: currentCode}));
        const newCode = cleanupCode(responseText);
        setCurrentCodeForActiveFile(newCode);
        setChatHistory(prev => [...prev, { sender: 'gemini', text: "I've modified the code in the editor. Please review, then Apply or Discard.", timestamp: new Date() }]);
        updateStatusBar('Gemini edited the code. Review changes.', 3000);
      } else {
        setChatHistory(prev => [...prev, { sender: 'gemini', text: responseText, timestamp: new Date() }]);
        updateStatusBar('Response received.', 3000);
      }
    } catch (error: any) {
      console.error("Error in chat:", error);
      setChatHistory(prev => [...prev, { sender: 'gemini', text: `Error: ${error.message}`, timestamp: new Date() }]);
      updateStatusBar('Chat error.', 3000);
    } finally {
      setLoadingState('chat', false);
    }
  }, [ai, currentCode, directEditMode, projectContext, identifiedLanguage, activeFilePath, activeChatSession, setCurrentCodeForActiveFile, applyFileOperations]);
  
  const handleApplyAnalysisSuggestion = useCallback(async (suggestion: Suggestion) => {
    if (!ai || !activeFilePath) return;
    setLoadingState('suggestionApply', true);
    updateStatusBar('Applying suggestion with AI...');
    setOriginalCodeForFile(prev => ({...prev, [activeFilePath]: currentCode}));
    setActiveTab('analysis'); 

    const prompt = `You are a code modification engine. The user wants to apply the following suggestion: "${suggestion.description}".
The instruction to achieve this is: "${suggestion.fix_prompt}".
IMPORTANT: You must ONLY output the complete, modified code. Do not add any explanation, commentary, or markdown code fences.
Original Code:\n---\n${currentCode}\n---`;
    
    try {
      const response = await ai.models.generateContent({model: GEMINI_MODEL_TEXT, contents: prompt});
      const newCode = cleanupCode(response.text);
      setCurrentCodeForActiveFile(newCode);
      updateStatusBar('AI applied suggestion. Review changes in editor.', 5000);
    } catch (error: any) {
      console.error("Error applying suggestion:", error);
      updateStatusBar(`Error applying suggestion: ${error.message}`, 5000);
    } finally {
      setLoadingState('suggestionApply', false);
    }
  }, [ai, currentCode, activeFilePath, setCurrentCodeForActiveFile]);

  const handlePreviewCode = useCallback(() => {
    if (!activeFilePath) {
        updateStatusBar("No active file to preview.", 3000);
        return;
    }
    const activeFile = projectFiles.find(f => f.path === activeFilePath);
    if (!activeFile || activeFile.type === 'folder') {
        updateStatusBar("Cannot preview a folder or non-existent file.", 3000);
        return;
    }

    // Check for complex project indicators
    const hasPackageJson = projectFiles.some(f => f.path.toLowerCase() === 'package.json');
    let isComplexProject = false;
    if (hasPackageJson) {
        const packageJsonFile = projectFiles.find(f => f.path.toLowerCase() === 'package.json');
        if (packageJsonFile && packageJsonFile.content) {
            try {
                const pkg = JSON.parse(packageJsonFile.content);
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (['react', 'vue', 'angular', 'vite', 'next', 'svelte', '@angular/core'].some(dep => deps[dep])) {
                    isComplexProject = true;
                }
            } catch (e) { console.warn("Could not parse package.json for preview check"); }
        }
    }
    if (projectFiles.some(f => ['vite.config.js', 'vite.config.ts', 'webpack.config.js', 'next.config.js'].includes(f.path.toLowerCase()))) {
        isComplexProject = true;
    }

    if (isComplexProject) {
        updateStatusBar("Preview for complex projects (React, Vue, Node, etc.) requires a build step and local server, or a sandboxing service. This is beyond simple client-side preview.", 10000);
        console.warn("Live preview for complex projects is not supported in this environment. Consider using local development or services like StackBlitz/CodeSandbox.");
        return;
    }
    
    // Simple HTML preview: Removed CSS/JS inlining for reliability
    if (activeFile.path.match(/\.(html|htm)$/i)) {
        const htmlContent = activeFile.content; // Use raw HTML content
        const previewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        window.open(previewUrl, '_blank');
        updateStatusBar(`Previewing ${activeFile.path}... (linked local CSS/JS will not apply in this basic preview)`, 5000);
    } else { // Fallback for non-HTML files
        const previewUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(activeFile.content)}`;
        window.open(previewUrl, '_blank');
        updateStatusBar(`Displaying content of ${activeFile.path}... (not an HTML preview)`, 3000);
    }
  }, [projectFiles, activeFilePath, updateStatusBar]);
  
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPanel serviceStatus={serviceStatus} />;
      case 'project':
        return <ProjectPanel 
                  projectFiles={projectFiles} 
                  activeFilePath={activeFilePath}
                  onFileSelect={setActiveFilePath}
                  setProjectFiles={setProjectFiles}
                  ai={ai}
                  updateStatusBar={updateStatusBar}
                  setLoadingState={setLoadingState}
                  isLoading={isLoading} 
                  applyFileOperations={applyFileOperations}
                  chatHistory={chatHistory}
                  setChatHistory={setChatHistory}
                  activeChatSession={activeChatSession}
                  setActiveChatSession={setActiveChatSession}
                  projectContext={projectContext}
                  currentCode={currentCode} 
                  identifiedLanguage={identifiedLanguage} 
                />;
      case 'analysis':
        return <AnalysisPanel analysisResult={analysisResult} onSuggestionClick={handleApplyAnalysisSuggestion} isLoading={!!isLoading['suggestionApply']} />;
      case 'chat':
        return (
          <ChatPanel
            chatHistory={chatHistory}
            onSendMessage={handleSendChatMessage}
            isLoading={!!isLoading['chat']}
            directEditMode={directEditMode}
            setDirectEditMode={setDirectEditMode}
          />
        );
      case 'gitlab':
        return (
          <GitLabPanel
            ai={ai}
            currentCode={currentCode} 
            activeFilePath={activeFilePath} 
            projectFiles={projectFiles} 
            identifiedLanguage={identifiedLanguage}
            projectContext={projectContext}
            setProjectContext={setProjectContext}
            initialFilePath={gitlabFilePath} 
            setFilePath={setGitlabFilePath} 
            initialBranch={gitlabBranch}
            setBranch={setGitlabBranch}
            initialCommitMessage={gitlabCommitMessage}
            setCommitMessage={setGitlabCommitMessage}
            lastPushedUrl={lastPushedGitLabUrl}
            setLastPushedUrl={setLastPushedGitLabUrl}
            updateStatusBar={updateStatusBar}
            setLoadingState={setLoadingState}
            isLoading={isLoading}
            onCiCdGenerated={(path, content, language) => {
                applyFileOperations([{action: 'updateFile', path, content}]);
                setActiveFilePath(path);
                setIdentifiedLanguage(language);
                setActiveTab('project'); 
            }}
            isGitLabConnected={isGitLabConnected}
            setIsGitLabConnected={setIsGitLabConnected}
            setServiceStatus={setServiceStatus}
          />
        );
      case 'cloud_search':
        return (
          <CloudSearchPanel
            ai={ai}
            currentCode={currentCode}
            projectContext={projectContext}
            results={cloudSearchResults}
            setResults={setCloudSearchResults}
            updateStatusBar={updateStatusBar}
            setLoadingState={setLoadingState}
            isLoading={!!isLoading['cloud_search_so'] || !!isLoading['cloud_search_docs']}
          />
        );
      default:
        return null;
    }
  };
  
  const NavButton: React.FC<{tabKey: TabKey; label: string; icon: string;}> = ({ tabKey, label, icon }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150
                  ${activeTab === tabKey 
                    ? 'bg-dark-accent text-dark-accent_fg' 
                    : 'text-dark-fg hover:bg-dark-select_bg'}`}
      aria-current={activeTab === tabKey ? 'page' : undefined}
    >
      <i className={`ph-${icon} ph-fill mr-2 text-lg`}></i>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen font-sans dark"> {/* Ensure 'dark' class is present */}
      <header className="flex items-center justify-between p-3 border-b border-dark-border bg-dark-bg shadow-sm">
        <div className="flex items-center">
          <i className="ph-tree-structure ph-fill text-3xl text-dark-accent mr-2"></i>
          <h1 className="text-2xl font-bold text-dark-fg">CodeWeaver AI</h1>
        </div>
        {/* Theme toggle button removed */}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col w-3/5 p-3 border-r border-dark-border">
           <div className="mb-2 text-xs text-dark-fg">
            Active File: <span className="font-semibold">{activeFilePath || "No file selected"}</span> (Lang: {identifiedLanguage})
          </div>
          <div className="flex-1 min-h-0"> 
            <CodeEditor
              code={currentCode}
              setCode={setCurrentCodeForActiveFile}
              onAnalyze={handleAnalyzeCode}
              onApplyChanges={handleApplyGeminiChanges}
              onDiscardChanges={handleDiscardGeminiChanges}
              onPreview={handlePreviewCode}
              language={identifiedLanguage}
              isLoadingAnalyze={!!isLoading['analyze']}
              applyEnabled={activeFilePath ? originalCodeForFile[activeFilePath] !== undefined : false}
              discardEnabled={activeFilePath ? originalCodeForFile[activeFilePath] !== undefined : false}
              originalCode={activeFilePath ? originalCodeForFile[activeFilePath] || null : null}
              filePath={activeFilePath}
            />
          </div>
        </div>

        <div className="flex flex-col w-2/5 p-3">
          <nav className="flex space-x-1 mb-3 border-b border-dark-border pb-2 overflow-x-auto" aria-label="Main navigation">
            <NavButton tabKey="dashboard" label="Dashboard" icon="gauge" />
            <NavButton tabKey="project" label="Project" icon="folder-simple" />
            <NavButton tabKey="analysis" label="Analysis" icon="magnifying-glass" />
            <NavButton tabKey="chat" label="Co-Coding" icon="chats-circle" />
            <NavButton tabKey="gitlab" label="GitLab" icon="git-branch" />
            <NavButton tabKey="cloud_search" label="Cloud Search" icon="cloud-arrow-up" />
          </nav>
          <main className="flex-1 overflow-y-auto bg-dark-input_bg p-3 rounded-md shadow-inner" tabIndex={-1}>
            {renderActiveTab()}
          </main>
        </div>
      </div>

      <footer className="p-2 border-t border-dark-border text-xs text-dark-fg bg-dark-bg">
        {statusBarMessage} {Object.values(isLoading).some(v => v) && <span className="ml-2" aria-live="polite">(Processing...)</span>}
      </footer>
    </div>
  );
};

export default App;
