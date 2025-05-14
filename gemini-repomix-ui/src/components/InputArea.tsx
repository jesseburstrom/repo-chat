// src/components/InputArea.tsx
import React, { useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent, FormEvent } from 'react';
// Removed: import './InputArea.css'; // Migrated to Tailwind

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [calculatedHeights, setCalculatedHeights] = useState<{ oneLine: number; fiveLines: number } | null>(null);

  // --- Calculate base heights on mount ---
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !calculatedHeights) {
        const computedStyle = getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const paddingBottom = parseFloat(computedStyle.paddingBottom);
        const borderTop = parseFloat(computedStyle.borderTopWidth);
        const borderBottom = parseFloat(computedStyle.borderBottomWidth);

        if (!isNaN(lineHeight)) {
            const paddingAndBorder = paddingTop + paddingBottom + borderTop + borderBottom;
            const oneLineHeight = lineHeight + paddingAndBorder;
            const fiveLineHeight = (5 * lineHeight) + paddingAndBorder;
            setCalculatedHeights({ oneLine: oneLineHeight, fiveLines: fiveLineHeight });
            textarea.style.height = `${oneLineHeight}px`;
            textarea.style.overflowY = 'hidden';
        } else {
            console.warn("Could not parse lineHeight for textarea height calculation.");
            const fallbackOneLine = 40;
            const fallbackFiveLines = 120;
             setCalculatedHeights({ oneLine: fallbackOneLine, fiveLines: fallbackFiveLines });
             textarea.style.height = `${fallbackOneLine}px`;
             textarea.style.overflowY = 'hidden';
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Adjust height based on content ---
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea && calculatedHeights) {
        const isEmpty = prompt.trim() === '';
        if (isEmpty) {
            textarea.style.height = `${calculatedHeights.oneLine}px`;
            textarea.style.overflowY = 'hidden';
        } else {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            if (scrollHeight <= calculatedHeights.fiveLines) {
                textarea.style.height = `${scrollHeight}px`;
                textarea.style.overflowY = 'hidden';
            } else {
                textarea.style.height = `${calculatedHeights.fiveLines}px`;
                textarea.style.overflowY = 'auto';
            }
        }
    }
  }, [prompt, calculatedHeights]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt, adjustTextareaHeight]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (prompt.trim() && !isLoading) {
      onPromptSubmit(prompt);
      setPrompt('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSubmit(event as any);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileAttach(file);
      event.target.value = '';
    }
  };

  // Button base classes
  const buttonBaseClasses = "mx-[5px] h-[40px] flex-shrink-0 self-end rounded-[4px] cursor-pointer disabled:bg-[#ccc] disabled:cursor-not-allowed";
  const attachButtonClasses = "px-[12px] py-[8px] border border-[#ced4da] bg-[#f8f9fa] text-[1.2em]";
  const submitButtonClasses = "px-[18px] py-[8px] border-none bg-[#1a73e8] text-white rounded-[18px] font-medium text-[0.9em] transition-colors duration-200 ease-in-out flex items-center gap-[5px] hover:enabled:bg-[#185abc]";

  return (
    // .input-area-container
    <div className="px-5 py-[15px] bg-white border-t border-[#e0e0e0]">
      {/* .input-form */}
      <form onSubmit={handleSubmit} className="flex items-end w-full">
         <button
            type="button"
            onClick={handleFileButtonClick}
            disabled={isLoading}
            className={`${buttonBaseClasses} ${attachButtonClasses}`} // Removed text color override, rely on default/emoji
            title="Attach Repomix Output File"
        >
            📎
        </button>
        <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".txt,.md"
        />

        {/* .prompt-input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your prompt (Shift+Enter for new line)..."
          className="flex-grow p-2.5 border border-[#ccc] rounded-[4px] text-base leading-[1.5] resize-none transition-height duration-100 ease-out disabled:bg-[#f0f0f0] focus:outline-none focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4caf50]/20"
          rows={1}
          disabled={isLoading}
          style={{ overflowY: 'hidden' }}
        />
         <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className={`${buttonBaseClasses} ${submitButtonClasses}`}
          title="Submit prompt (Enter)"
        >
          {isLoading ? 'Thinking...' : 'Send'}
          {/* Optional: Shortcut display - removed as per original comment */}
          {/* <span className="text-[0.8em] opacity-70">(Ctrl+↵)</span> */}
        </button>
      </form>
      {/* .attached-file-indicator */}
      {attachedFileName && (
        <div className="text-[0.85em] text-[#555] mt-[5px] pl-[50px]">
            Attached: {attachedFileName}
        </div>
      )}
    </div>
  );
};

export default InputArea;