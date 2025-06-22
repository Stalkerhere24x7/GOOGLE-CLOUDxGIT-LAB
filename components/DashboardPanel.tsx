
import React from 'react';
import { ServiceStatus } from '../types';

interface DashboardPanelProps {
  serviceStatus: ServiceStatus;
}

const StatusIndicator: React.FC<{ statusValue: boolean | string; label: string }> = ({ statusValue, label }) => {
  let isOk: boolean;
  let displayStatus: string;

  if (typeof statusValue === 'boolean') {
    isOk = statusValue;
    displayStatus = statusValue ? 'OK' : 'Error';
  } else { // string
    const lowerStatus = statusValue.toLowerCase();
    isOk = lowerStatus.includes('ok') || lowerStatus.includes('available') || lowerStatus.includes('connected');
    displayStatus = statusValue;
  }
  
  const color = isOk ? 'text-green-400' : 'text-red-400'; // Dark theme colors
  
  return (
    <p className="text-sm mb-1">
      {label}: <span className={`font-semibold ${color}`}>{displayStatus}</span>
    </p>
  );
};

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ serviceStatus }) => {
  const htmlContent = `
    <h1 class="text-xl font-bold mb-3 text-dark-fg">Welcome to CodeWeaver AI</h1>
    <p class="text-sm mb-4 text-dark-fg">Your integrated DevSecOps environment, powered by Google Gemini. (Dark Mode)</p>
    
    <h2 class="text-lg font-semibold mb-2 text-dark-fg">Service Status</h2>
    <!-- Status indicators will be rendered by React components for better control -->

    <h2 class="text-lg font-semibold mt-6 mb-2 text-dark-fg">Getting Started</h2>
    <ul class="list-disc list-inside text-sm space-y-1 text-dark-fg">
      <li>In the <b>Code Editor</b>, write or paste code, then click <b>Analyze Code</b> to get AI insights and auto-detect language.</li>
      <li>Applied analysis suggestions directly modify your code. Review and then <b>Apply</b> or <b>Discard Changes</b> in the editor.</li>
      <li>Use the <b>Co-Coding Chat</b> tab to refactor, debug, or write new code with Gemini.</li>
      <li>Enable <b>Direct Code Edit Mode</b> in chat to have the AI modify your code directly.</li>
      <li>In <b>Project Control</b> (GitLab tab):
          <ul>
            <li>Connect to your GitLab instance using a Personal Access Token.</li>
            <li>Push your current code from the editor to your repository.</li>
            <li>Generate a project summary or a .gitlab-ci.yml file using AI.</li>
          </ul>
      </li>
      <li>Use <b>Cloud Search</b> to get Stack Overflow solutions for your coding problems, powered by Gemini and Google Search.</li>
    </ul>
    
    <p class="text-xs mt-6 text-gray-400">
      Note: Google Cloud BigQuery integration is conceptual for this client-side version and marked 'Unavailable' as it typically requires backend infrastructure. 
      GitLab integration requires your PAT and connects directly to your GitLab instance.
    </p>
  `;

  return (
    <div className="p-1">
      <div dangerouslySetInnerHTML={{ __html: htmlContent.split('<!-- Status indicators')[0] }} />
      <StatusIndicator statusValue={serviceStatus.gemini} label="Gemini AI" />
      <StatusIndicator statusValue={serviceStatus.gitlab} label="GitLab Integration" />
      <StatusIndicator statusValue={serviceStatus.bigQuery} label="Google Cloud BigQuery" />
      <div dangerouslySetInnerHTML={{ __html: htmlContent.split('<!-- Status indicators')[1].split('-->')[1] }} />
    </div>
  );
};