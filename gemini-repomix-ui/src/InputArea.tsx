// src/InputArea.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null); // <-- Ref for the textarea
// State to store calculated heights (in pixels)
const [calculatedHeights, setCalculatedHeights] = useState<{ oneLine: number; fiveLines: number } | null>(null);

// --- Calculate base heights on mount ---
useEffect(() => {
    const textarea = textareaRef.current;
    // Calculate only once when the component mounts and textarea is available
    if (textarea && !calculatedHeights) {
        const computedStyle = getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const paddingBottom = parseFloat(computedStyle.paddingBottom);
        const borderTop = parseFloat(computedStyle.borderTopWidth);
        const borderBottom = parseFloat(computedStyle.borderBottomWidth);

        // Calculate total height = (lines * lineHeight) + padding + border
        // Ensure lineHeight is not NaN before calculation
        if (!isNaN(lineHeight)) {
            const paddingAndBorder = paddingTop + paddingBottom + borderTop + borderBottom;
            const oneLineHeight = lineHeight + paddingAndBorder;
            const fiveLineHeight = (5 * lineHeight) + paddingAndBorder;
            setCalculatedHeights({ oneLine: oneLineHeight, fiveLines: fiveLineHeight });

            // Set initial height explicitly to one line
            textarea.style.height = `${oneLineHeight}px`;
            textarea.style.overflowY = 'hidden'; // Initially no scrollbar
        } else {
            console.warn("Could not parse lineHeight for textarea height calculation.");
            // Fallback (optional): set some default heights or log error
            const fallbackOneLine = 40; // Example fallback
            const fallbackFiveLines = 120; // Example fallback
             setCalculatedHeights({ oneLine: fallbackOneLine, fiveLines: fallbackFiveLines });
             textarea.style.height = `${fallbackOneLine}px`;
             textarea.style.overflowY = 'hidden';
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Dependency array is empty to run only once on mount

// --- Adjust height based on content ---
const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    // Ensure calculation is done and textarea exists
    if (textarea && calculatedHeights) {
        const isEmpty = prompt.trim() === '';

        if (isEmpty) {
            // If empty, reset to exactly one line height
            textarea.style.height = `${calculatedHeights.oneLine}px`;
            textarea.style.overflowY = 'hidden';
        } else {
            // Temporarily remove height constraint to measure scrollHeight correctly
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;

            // Compare scrollHeight with the calculated 5-line height limit
            if (scrollHeight <= calculatedHeights.fiveLines) {
                // Content fits within 5 lines: set height to content height
                textarea.style.height = `${scrollHeight}px`;
                textarea.style.overflowY = 'hidden'; // No scrollbar needed
            } else {
                // Content exceeds 5 lines: fix height to 5 lines and show scrollbar
                textarea.style.height = `${calculatedHeights.fiveLines}px`;
                textarea.style.overflowY = 'auto'; // Or 'scroll'
            }
        }
    }
}, [prompt, calculatedHeights]); // Depend on prompt and calculated heights

// Adjust height immediately when prompt changes
useEffect(() => {
    adjustTextareaHeight();
}, [prompt, adjustTextareaHeight]);

  // const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
  //   setPrompt(event.target.value);
  //   // Height adjustment is handled by the useEffect watching 'prompt'
  // };
  
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
          ref={textareaRef} // <-- Assign the ref here
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your prompt (Shift+Enter for new line)..." // Inform user about Shift+Enter
          className="prompt-input"
          rows={1} // Start with one row, auto-expand with CSS
          disabled={isLoading}
          // Inline style for height will be managed by JS
          style={{ overflowY: 'hidden' }} // Hide scrollbar initially (unless max-height is implemented and reached)
        />
         <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="submit-button"
          title="Submit prompt (Enter)" // Add tooltip
        >
          {isLoading ? 'Thinking...' : 'Send'} {/* Changed 'Run' to 'Send' */}
          {/* Optional: Remove Ctrl+Enter shortcut display if only Enter works now
           <span className="shortcut">(Ctrl+↵)</span> */}
        </button>
      </form>
      {attachedFileName && <div className="attached-file-indicator">Attached: {attachedFileName}</div>}
    </div>
  );
};

export default InputArea;