
import React, { useRef, useEffect } from 'react';
import { Button } from './common/Button';
import { IdentifiedLanguage } from '../types';
import * as Diff from 'diff';

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  onAnalyze: () => void;
  onPreview: () => void;
  onApplyChanges: () => void;
  onDiscardChanges: () => void;
  language: IdentifiedLanguage;
  isLoadingAnalyze: boolean;
  applyEnabled: boolean;
  discardEnabled: boolean;
  originalCode: string | null; 
  filePath: string | null; // To manage diff view correctly when active file changes
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  setCode,
  onAnalyze,
  onPreview,
  onApplyChanges,
  onDiscardChanges,
  language,
  isLoadingAnalyze,
  applyEnabled,
  discardEnabled,
  originalCode,
  filePath,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const diffViewRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (filePath && originalCode && diffViewRef.current) {
      const diff = Diff.diffLines(originalCode, code, { newlineIsToken: true });
      let html = '';
      diff.forEach((part) => {
        const colorClass = part.added ? 'bg-green-500 bg-opacity-20 dark:bg-green-700 dark:bg-opacity-30' :
                      part.removed ? 'bg-red-500 bg-opacity-20 dark:bg-red-700 dark:bg-opacity-30' :
                      '';
        const escapedValue = part.value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        html += `<span class="${colorClass}">${escapedValue}</span>`;
      });
      diffViewRef.current.innerHTML = html;
    } else if (diffViewRef.current) {
      diffViewRef.current.innerHTML = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Show current code if no diff
    }
  }, [code, originalCode, filePath]);


  return (
    <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md shadow-sm">
      <div className="flex items-center p-2 border-b border-light-border dark:border-dark-border space-x-2 flex-wrap">
        <Button onClick={onAnalyze} isLoading={isLoadingAnalyze} size="sm" variant="secondary" icon={<i className="ph-magnifying-glass ph-fill"></i>} disabled={!filePath}>
          Analyze
        </Button>
        <Button onClick={onPreview} size="sm" variant="secondary" icon={<i className="ph-eye ph-fill"></i>} disabled={!filePath}>
          Preview
        </Button>
        {applyEnabled && (
          <Button onClick={onApplyChanges} size="sm" variant="primary" icon={<i className="ph-check ph-fill"></i>} disabled={!filePath}>
            Apply Changes
          </Button>
        )}
        {discardEnabled && (
          <Button onClick={onDiscardChanges} size="sm" variant="danger" icon={<i className="ph-x ph-fill"></i>} disabled={!filePath}>
            Discard Changes
          </Button>
        )}
      </div>
      <div className="flex-1 relative overflow-hidden">
        {originalCode && filePath ? ( // Show diff view only if originalCode for current filePath exists
          <pre 
            ref={diffViewRef}
            className="w-full h-full p-2 font-mono text-sm whitespace-pre-wrap overflow-auto bg-light-text_bg dark:bg-dark-text_bg text-light-fg dark:text-dark-fg resize-none focus:outline-none leading-relaxed"
            aria-label="Code changes diff view"
            tabIndex={0} 
          ></pre>
        ) : (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full p-2 font-mono text-sm bg-light-text_bg dark:bg-dark-text_bg text-light-fg dark:text-dark-fg resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 leading-relaxed"
            placeholder={filePath ? "Enter or generate code here..." : "Select a file from the Project panel to start editing."}
            spellCheck="false"
            aria-label="Code editor"
            aria-multiline="true"
            disabled={!filePath}
          />
        )}
      </div>
    </div>
  );
};
