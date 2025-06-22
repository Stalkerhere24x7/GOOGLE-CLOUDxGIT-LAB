
import React from 'react';
import { AnalysisData, Suggestion } from '../types';

export type { AnalysisData }; 

interface AnalysisPanelProps {
  analysisResult: AnalysisData | null;
  onSuggestionClick: (suggestion: Suggestion) => void; 
  isLoading: boolean; 
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysisResult, onSuggestionClick, isLoading }) => {
  if (!analysisResult) {
    return <div className="p-4 text-sm text-gray-400" role="status">Run code analysis to see results here.</div>;
  }

  return (
    <div className="p-1 space-y-4">
      <div>
        <h3 className="text-md font-semibold mb-1 text-dark-fg">Code Language</h3>
        <p className="text-sm text-dark-fg">{analysisResult.language || 'Not automatically detected'}</p>
      </div>
      <div>
        <h3 className="text-md font-semibold mb-1 text-dark-fg">Purpose &amp; Breakdown</h3>
        <p className="text-sm text-dark-fg whitespace-pre-wrap">{analysisResult.breakdown || 'No breakdown available.'}</p>
      </div>
      <div>
        <h3 className="text-md font-semibold mb-1 text-dark-fg" id="suggestions-heading">Suggestions</h3>
        {analysisResult.suggestions && analysisResult.suggestions.length > 0 ? (
          <ul className="list-disc list-inside space-y-2" aria-labelledby="suggestions-heading">
            {analysisResult.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-dark-fg">
                {suggestion.description}
                {suggestion.fix_prompt && (
                  <button
                    onClick={() => onSuggestionClick(suggestion)}
                    disabled={isLoading}
                    className="ml-2 text-xs text-dark-link_fg hover:underline focus:outline-none disabled:opacity-50 disabled:cursor-wait"
                    aria-label={`Apply suggestion: ${suggestion.description}`}
                  >
                    {isLoading ? '(Applying...)' : '(Apply with AI)'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No specific suggestions provided.</p>
        )}
      </div>
       {isLoading && ( 
          <div className="flex items-center text-sm text-dark-fg" role="status" aria-live="polite">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Applying suggestion to code editor...
          </div>
        )}
    </div>
  );
};