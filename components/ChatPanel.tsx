
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './common/Button';
import { TextInput } from './common/TextInput';
import { ChatMessage, FileOperation } from '../types'; 

export type { ChatMessage }; 

interface ChatPanelProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  directEditMode: boolean;
  setDirectEditMode: (enabled: boolean) => void;
}

const renderFileOperations = (ops: FileOperation[]) => (
  <div className="mt-2 text-xs border-t border-dark-border border-opacity-50 pt-1">
    <p className="font-semibold mb-0.5">File Operations Suggested:</p>
    <ul className="list-disc list-inside pl-1 space-y-0.5">
      {ops.map((op, i) => (
        <li key={i}>
          <strong className="capitalize">{op.action.replace(/([A-Z])/g, ' $1').trim()}</strong>: <code>{op.path}</code>
          {op.action.includes('File') && op.content && op.content.length > 0 && <span className="text-gray-500"> (+content)</span>}
        </li>
      ))}
    </ul>
  </div>
);


export const ChatPanel: React.FC<ChatPanelProps> = ({
  chatHistory,
  onSendMessage,
  isLoading,
  directEditMode,
  setDirectEditMode,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-1 overflow-y-auto space-y-3">
        {chatHistory.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-lg shadow ${
                msg.sender === 'user'
                  ? 'bg-dark-accent text-dark-accent_fg'
                  : 'bg-dark-bg border border-dark-border text-dark-fg'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              {msg.sender === 'gemini' && msg.fileOperations && msg.fileOperations.length > 0 && renderFileOperations(msg.fileOperations)}
               {msg.timestamp && (
                 <p className="text-xs opacity-60 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </p>
               )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-1 border-t border-dark-border">
        <div className="mb-2">
            <label className="flex items-center text-xs text-dark-fg cursor-pointer">
              <input
                type="checkbox"
                checked={directEditMode}
                onChange={(e) => setDirectEditMode(e.target.checked)}
                className="mr-2 h-4 w-4 rounded text-dark-accent focus:ring-dark-accent border-gray-600 bg-dark-input_bg"
              />
              Direct Code Edit Mode (AI text responses modify active file's code)
            </label>
            <p className="text-xs text-gray-400 ml-6">
                Note: AI-suggested file operations (create, delete, etc.) will always be attempted if provided in the correct JSON format, regardless of this checkbox.
            </p>
        </div>
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <TextInput
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Gemini to help (e.g., 'create a new html file named test.html')..."
            className="flex-1 text-sm !bg-dark-input_bg !text-dark-fg"
            disabled={isLoading}
            aria-label="Chat input"
          />
          <Button type="submit" isLoading={isLoading} disabled={isLoading || !inputValue.trim()} icon={<i className="ph-paper-plane-tilt ph-fill"></i>}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};