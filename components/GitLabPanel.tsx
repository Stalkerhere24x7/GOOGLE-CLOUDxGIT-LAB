
import React, { useState, useEffect } from 'react';
import { Button } from './common/Button';
import { TextInput, TextArea } from './common/TextInput';
import { GoogleGenAI } from "@google/genai";
import { ProjectFile, IdentifiedLanguage, ServiceStatus, TabKey } from '../types'; // Added ProjectFile
import { GEMINI_MODEL_TEXT } from '../constants';
import { cleanupCode } from '../utils/textUtils';

interface GitLabPanelProps {
  ai: GoogleGenAI | null;
  currentCode: string; // Content of active file
  activeFilePath: string | null; // Path of active file
  projectFiles: ProjectFile[]; // All project files for potential full project push
  identifiedLanguage: IdentifiedLanguage;
  projectContext: string;
  setProjectContext: (context: string) => void;
  
  initialFilePath: string;
  setFilePath: (path: string) => void; 
  initialBranch: string;
  setBranch: (branch: string) => void; 
  initialCommitMessage: string;
  setCommitMessage: (message: string) => void; 

  lastPushedUrl: string | null;
  setLastPushedUrl: (url: string | null) => void;
  updateStatusBar: (message: string, duration?: number) => void;
  setLoadingState: (key: string, value: boolean) => void;
  isLoading: {[key: string]: boolean};
  
  // Callback for when CI/CD file is generated
  onCiCdGenerated: (path: string, content: string, language: IdentifiedLanguage) => void;
  
  isGitLabConnected: boolean;
  setIsGitLabConnected: (connected: boolean) => void;
  setServiceStatus: React.Dispatch<React.SetStateAction<ServiceStatus>>;
}

export const GitLabPanel: React.FC<GitLabPanelProps> = ({
  ai,
  currentCode,
  activeFilePath,
  projectFiles,
  identifiedLanguage,
  projectContext,
  setProjectContext,
  initialFilePath, // This is now more of a default/suggestion, actual path from activeFilePath
  setFilePath, // App's setter for file path if needed, though mostly driven by activeFilePath
  initialBranch,
  setBranch,
  initialCommitMessage,
  setCommitMessage,
  lastPushedUrl,
  setLastPushedUrl,
  updateStatusBar,
  setLoadingState,
  isLoading,
  onCiCdGenerated,
  isGitLabConnected,
  setIsGitLabConnected,
  setServiceStatus
}) => {
  const [instanceUrlInput, setInstanceUrlInput] = useState<string>('https://gitlab.com');
  const [projectPathInput, setProjectPathInput] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  
  // Local state for file path, branch, commit message. Synced with activeFilePath or App's state.
  const [filePathInput, setFilePathInput] = useState<string>(activeFilePath || initialFilePath);
  const [branchInput, setBranchInput] = useState<string>(initialBranch);
  const [commitMessageInput, setCommitMessageInput] = useState<string>(initialCommitMessage);

  useEffect(() => {
    setFilePathInput(activeFilePath || initialFilePath);
  }, [activeFilePath, initialFilePath]);

  useEffect(() => setBranchInput(initialBranch), [initialBranch]);
  useEffect(() => setCommitMessageInput(initialCommitMessage), [initialCommitMessage]);

  const handleConnectToGitLab = async () => {
    // ... (connection logic remains the same)
    if (!instanceUrlInput.trim() || !projectPathInput.trim() || !tokenInput.trim()) {
      updateStatusBar('Instance URL, Project Path, and Token are required.', 3000);
      return;
    }
    setLoadingState('gitlabConnect', true);
    updateStatusBar('Connecting to GitLab...');
    setServiceStatus(prev => ({ ...prev, gitlab: 'Connecting...' }));

    try {
      const apiUrl = `${instanceUrlInput.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(projectPathInput.trim())}`;
      const response = await fetch(apiUrl, {
        headers: { 'PRIVATE-TOKEN': tokenInput.trim() }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Failed to connect: ${errorData.message || response.status}`);
      }
      setIsGitLabConnected(true);
      setServiceStatus(prev => ({ ...prev, gitlab: `Connected to ${instanceUrlInput}/${projectPathInput.trim()}` }));
      updateStatusBar('Successfully connected to GitLab project!', 3000);
    } catch (error: any) {
      console.error("GitLab connection error:", error);
      setIsGitLabConnected(false);
      setServiceStatus(prev => ({ ...prev, gitlab: `Connection Failed: ${error.message.substring(0,50)}`}));
      updateStatusBar(`GitLab connection failed: ${error.message}`, 5000);
    } finally {
      setLoadingState('gitlabConnect', false);
    }
  };

  const handleDisconnectFromGitLab = () => {
    // ... (disconnect logic remains the same)
    setIsGitLabConnected(false);
    setServiceStatus(prev => ({ ...prev, gitlab: 'Disconnected' }));
    updateStatusBar('Disconnected from GitLab.', 3000);
  };

  const handlePushToGitLab = async () => {
    if (!isGitLabConnected) {
      updateStatusBar('Not connected to GitLab.', 3000);
      return;
    }
    if (!filePathInput.trim() || !branchInput.trim() || !commitMessageInput.trim()) {
        updateStatusBar('File path, branch, and commit message are required for push.', 5000);
        return;
    }
    if (!currentCode && activeFilePath) { // Check if there's content for the active file
        updateStatusBar(`No content in active file ${activeFilePath} to push.`, 3000);
        return;
    }
    if (!activeFilePath) {
        updateStatusBar('No active file selected to push.', 3000);
        return;
    }


    setLoadingState('gitlabPush', true);
    updateStatusBar(`Pushing ${activeFilePath} to GitLab...`);

    const commitPayload = {
      branch: branchInput.trim(),
      commit_message: commitMessageInput.trim(),
      actions: [
        {
          action: 'update', // Default action, will be refined
          file_path: filePathInput.trim(), // This should be the path in the repo
          content: currentCode, // Content of the active file
        },
      ],
    };

    try {
      let fileExists = false;
      const fileCheckUrl = `${instanceUrlInput.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(projectPathInput.trim())}/repository/files/${encodeURIComponent(filePathInput.trim())}?ref=${encodeURIComponent(branchInput.trim())}`;
      try {
        const fileCheckResponse = await fetch(fileCheckUrl, {
            method: 'GET', // HEAD might not be allowed for all users/setups, GET is safer for content check if needed
            headers: { 'PRIVATE-TOKEN': tokenInput.trim() }
        });
        if (fileCheckResponse.ok) {
            fileExists = true;
        } else if (fileCheckResponse.status !== 404) {
             const errorData = await fileCheckResponse.json().catch(() => ({ message: fileCheckResponse.statusText }));
             console.warn(`File check issue (status ${fileCheckResponse.status}): ${errorData.message}`);
        }
      } catch (e) { console.warn("Error checking file existence:", e); }
      
      commitPayload.actions[0].action = fileExists ? 'update' : 'create';

      const apiUrl = `${instanceUrlInput.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(projectPathInput.trim())}/repository/commits`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': tokenInput.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commitPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Push failed: ${errorData.message || response.status}`);
      }
      const commitData = await response.json();
      setLastPushedUrl(commitData.web_url); // This URL is for the commit itself
      updateStatusBar(`Successfully pushed ${activeFilePath} to GitLab!`, 3000);
    } catch (error: any) {
      console.error("GitLab push error:", error);
      updateStatusBar(`GitLab push failed: ${error.message}`, 5000);
      setLastPushedUrl(null);
    } finally {
      setLoadingState('gitlabPush', false);
    }
  };
  
  const handleViewLastPush = () => {
    if (!isGitLabConnected) {
      updateStatusBar('Not connected to GitLab.', 3000);
      return;
    }
    if (lastPushedUrl) {
      window.open(lastPushedUrl, '_blank');
    } else {
      updateStatusBar('No push data available. Push to GitLab first.', 3000);
    }
  };

  const handleViewPipelines = () => {
    if (!isGitLabConnected || !projectPathInput.trim()) {
        updateStatusBar('Not connected to a GitLab project.', 3000);
        return;
    }
    const pipelinesUrl = `${instanceUrlInput.replace(/\/$/, '')}/${projectPathInput.trim()}/-/pipelines`;
    window.open(pipelinesUrl, '_blank');
  };
  
  const handleGenerateSummary = async () => {
    // ... (summary generation logic remains the same, uses currentCode of active file)
    if (!ai) return;
    setLoadingState('summary', true);
    updateStatusBar('Generating project summary with AI...');
    const contextForSummary = projectFiles.map(f => `File: ${f.path}\nContent (first 200 chars):\n${f.content.substring(0,200)}\n---\n`).join('\n');

    const prompt = `Analyze this project structure and code snippets. Create a concise summary of its purpose, tech stack, and structure for a project README. Output only the summary in markdown format.\nProject Files Overview:\n${contextForSummary}\n\nMain active file (${activeFilePath}):\n\`\`\`${identifiedLanguage}\n${currentCode}\n\`\`\``;
    try {
      const response = await ai.models.generateContent({model: GEMINI_MODEL_TEXT, contents: prompt});
      setProjectContext(response.text); // This updates the shared project context
      updateStatusBar('Project summary generated and updated.', 3000);
    } catch (error: any) {
      console.error("Error generating summary:", error);
      updateStatusBar(`Summary generation failed: ${error.message}`, 5000);
    } finally {
      setLoadingState('summary', false);
    }
  };

  const handleGenerateCICD = async () => {
    if (!ai) return;
    if (!window.confirm("This will generate a .gitlab-ci.yml file. If it exists, its content will be updated. The file will then be opened in the editor. Continue?")) {
      return;
    }
    setLoadingState('cicd', true);
    updateStatusBar('Generating .gitlab-ci.yml with AI...');
    
    // Attempt to gather more context from project files
    let projectFilesOverview = "Project files include: " + projectFiles.map(f => f.path).join(", ") + ". ";
    if (projectFiles.some(f => f.path.includes('package.json'))) projectFilesOverview += "Seems to be a Node.js/JavaScript project. ";
    if (projectFiles.some(f => f.path.includes('requirements.txt') || f.path.endsWith('.py'))) projectFilesOverview += "Seems to be a Python project. ";


    const prompt = `Based on the provided project context, current active file language (${identifiedLanguage}), and project files overview, create a complete and effective .gitlab-ci.yml file.
It should include stages for build, test, and deploy (with a placeholder deploy job).
Make smart assumptions for a standard project of this type. For a Python project, use a standard Python image, include 'pip install -r requirements.txt', and jobs for linting (e.g., flake8) and testing (e.g., pytest).
For a web project (JS/TS/HTML), suggest static analysis, build (if applicable, e.g. for React/Vue/Angular), and deployment to GitLab Pages.
For Java, suggest Maven/Gradle.
IMPORTANT: Output ONLY the raw YAML content, with no explanations or markdown fences like \`\`\`yaml.
Project Context:\n${projectContext}\n\nProject Files Overview:\n${projectFilesOverview}\n\nCurrently active file (${activeFilePath || 'none'}) language: ${identifiedLanguage}\nCode (first 1000 chars of active file):\n\`\`\`${identifiedLanguage}\n${currentCode.substring(0,1000)}\n\`\`\``;

    try {
      const response = await ai.models.generateContent({ model: GEMINI_MODEL_TEXT, contents: prompt });
      const cleanedYaml = cleanupCode(response.text); 
      onCiCdGenerated('.gitlab-ci.yml', cleanedYaml, 'yaml'); // Use callback
      updateStatusBar('.gitlab-ci.yml generated/updated! Review in editor.', 5000);
    } catch (error: any) {
      console.error("Error generating CI/CD file:", error);
      updateStatusBar(`CI/CD generation failed: ${error.message}`, 5000);
    } finally {
      setLoadingState('cicd', false);
    }
  };


  return (
    <div className="space-y-6 p-1">
      {/* GitLab Connection */}
      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">GitLab Connection</h3>
        {!isGitLabConnected ? (
          <div className="space-y-3 p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg">
            <TextInput label="GitLab Instance URL:" value={instanceUrlInput} onChange={(e) => setInstanceUrlInput(e.target.value)} placeholder="https://gitlab.com" aria-label="GitLab Instance URL"/>
            <TextInput label="Project Path (namespace/project):" value={projectPathInput} onChange={(e) => setProjectPathInput(e.target.value)} placeholder="e.g., your-name/my-project" aria-label="GitLab Project Path"/>
            <TextInput label="Personal Access Token (PAT):" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Enter your PAT (api, read_repository, write_repository scopes)" aria-label="GitLab Personal Access Token"/>
            <Button onClick={handleConnectToGitLab} isLoading={!!isLoading['gitlabConnect']} size="sm" variant="primary" icon={<i className="ph-plugs ph-fill"></i>}>
              Connect to GitLab
            </Button>
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                Token is stored in memory for the session. Ensure it has 'api', 'read_repository', and 'write_repository' scopes.
            </p>
          </div>
        ) : (
          <div className="p-3 border border-green-500 dark:border-green-400 rounded-md bg-green-50 dark:bg-green-900_alpha_20">
             <p className="text-sm text-green-700 dark:text-green-300">
                Connected to: {instanceUrlInput}/{projectPathInput}
            </p>
            <div className="mt-2 space-x-2">
                <Button onClick={handleDisconnectFromGitLab} size="sm" variant="secondary" icon={<i className="ph-plugs-connected ph-fill"></i>}>
                Disconnect
                </Button>
                <Button onClick={handleViewPipelines} size="sm" variant="secondary" icon={<i className="ph-rocket ph-fill"></i>}>
                    View Pipelines
                </Button>
            </div>
          </div>
        )}
      </section>

      {/* AI Project Context */}
      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">AI Project Context</h3>
        <TextArea
          value={projectContext}
          onChange={(e) => setProjectContext(e.target.value)}
          rows={3}
          placeholder="Enter or generate a summary of your project for AI context..."
          className="text-sm"
          aria-label="AI Project Context"
        />
        <Button onClick={handleGenerateSummary} isLoading={!!isLoading['summary']} size="sm" variant="secondary" className="mt-2" icon={<i className="ph-brain ph-fill"></i>}>
          Generate Summary from Project
        </Button>
      </section>

      {/* GitLab Version Control - Pushes active file for now */}
      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">GitLab Version Control (Active File)</h3>
        <p className="text-xs mb-2 text-gray-500 dark:text-gray-400">
            Operations below apply to the currently active file in the editor: <span className="font-semibold">{activeFilePath || "None"}</span>.
        </p>
        <div className="space-y-3">
          <TextInput 
            label="File Path in Repo:" 
            value={filePathInput} 
            onChange={(e) => { setFilePathInput(e.target.value); setFilePath(e.target.value); }} 
            placeholder="e.g., src/main.py" 
            aria-label="GitLab File Path"
            disabled={!isGitLabConnected || !!isLoading['gitlabPush'] || !activeFilePath}
          />
          <TextInput 
            label="Branch Name:" 
            value={branchInput} 
            onChange={(e) => { setBranchInput(e.target.value); setBranch(e.target.value); }} 
            placeholder="e.g., main or feature/new-task" 
            aria-label="GitLab Branch Name"
            disabled={!isGitLabConnected || !!isLoading['gitlabPush']}
          />
          <TextInput 
            label="Commit Message:" 
            value={commitMessageInput} 
            onChange={(e) => { setCommitMessageInput(e.target.value); setCommitMessage(e.target.value); }} 
            placeholder="e.g., feat: Implement X" 
            aria-label="GitLab Commit Message"
            disabled={!isGitLabConnected || !!isLoading['gitlabPush']}
          />
        </div>
        <div className="mt-3 space-x-2">
          <Button 
            onClick={handlePushToGitLab} 
            size="sm" 
            icon={<i className="ph-git-commit ph-fill"></i>} 
            disabled={!isGitLabConnected || !!isLoading['gitlabPush'] || !activeFilePath}
            isLoading={!!isLoading['gitlabPush']}
          >
            Push Active File
          </Button>
          <Button 
            onClick={handleViewLastPush} 
            disabled={!isGitLabConnected || !lastPushedUrl} 
            size="sm" 
            variant="secondary" 
            icon={<i className="ph-eye ph-fill"></i>}
          >
            View Last Push
          </Button>
        </div>
         {/* Future: Add option to push entire project */}
      </section>

      {/* AI-Powered CI/CD Helper */}
      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">AI-Powered CI/CD Helper</h3>
        <p className="text-xs mb-2 text-gray-500 dark:text-gray-400">
            Let Gemini generate or update a .gitlab-ci.yml file for your project.
            The file will be opened in the editor for review.
        </p>
        <Button onClick={handleGenerateCICD} isLoading={!!isLoading['cicd']} size="sm" variant="secondary" icon={<i className="ph-rocket-launch ph-fill"></i>}>
          Generate/Update .gitlab-ci.yml
        </Button>
      </section>
    </div>
  );
};