// src/InputArea.tsx
import React, { useState, useRef } from 'react';
import './InputArea.css'; // We'll create this CSS file

interface InputAreaProps {
  onPromptSubmit: (prompt: string) => void;
  onFileAttach: (file: File) => void;
  isLoading: boolean;
  attachedFileName: string | null;
}

const InputArea: React.FC<InputAreaProps> = ({
  onPromptSubmit,
  onFileAttach,
  isLoading,
  attachedFileName,
}) => {
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (prompt.trim() && !isLoading) {
      onPromptSubmit(prompt);
      setPrompt(''); // Clear input after submit
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault(); // Prevent newline on Enter
      handleSubmit(event as any); // Submit form
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileAttach(file);
       // Reset file input to allow attaching the same file again if needed
       event.target.value = '';
    }
  };

  return (
    <div className="input-area-container">
      <form onSubmit={handleSubmit} className="input-form">
         <button
            type="button"
            onClick={handleFileButtonClick}
            disabled={isLoading}
            className="attach-button"
            title="Attach Repomix Output File"
        >
            📎 {/* Use an icon font or SVG for better results */}
        </button>
        <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".txt,.md" // Accept text and markdown files
        />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type something..."
          className="prompt-input"
          rows={1} // Start with one row, auto-expand with CSS
          disabled={isLoading}
        />
         <button type="submit" disabled={isLoading || !prompt.trim()} className="submit-button">
             {isLoading ? 'Thinking...' : 'Run'} <span className="shortcut">(Ctrl+↵)</span>
         </button>
      </form>
      {attachedFileName && <div className="attached-file-indicator">Attached: {attachedFileName}</div>}
    </div>
  );
};

export default InputArea;