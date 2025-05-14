// gemini-repomix-ui/src/components/ApiKeyModal.tsx
import React, { useState } from 'react';
import * as api from '../services/api';
// Removed: import './ApiKeyModal.css'; // Migrated to Tailwind

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onKeySubmitted: () => void; // To refresh status or UI
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySubmitted }) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError('API Key cannot be empty.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        const result = await api.setGeminiApiKey(apiKey);
        setIsLoading(false);

        if (result.success) {
            setSuccessMessage(result.message || 'API Key submitted successfully! You can close this modal.');
            setApiKey('');
            onKeySubmitted();
        } else {
            setError(result.error || 'Failed to submit API Key.');
        }
    };

    const handleDeleteKey = async () => {
         setIsLoading(true);
         setError(null);
         setSuccessMessage(null);
         const result = await api.setGeminiApiKey(""); // Send empty string to delete
         setIsLoading(false);
         if (result.success) {
             setSuccessMessage("API Key removed successfully.");
             onKeySubmitted();
         } else {
             setError(result.error || "Failed to remove API key.");
         }
    };

    if (!isOpen) {
        return null;
    }

    // Base classes for reuse
    const modalButtonBaseClasses = "px-[18px] py-[9px] border-none rounded-[4px] cursor-pointer font-medium text-[0.95em] transition-colors duration-200 ease-in-out disabled:bg-[#ccc] disabled:opacity-70 disabled:cursor-not-allowed";
    const primaryButtonClasses = "bg-[#1a73e8] text-white hover:enabled:bg-[#185abc]";
    const secondaryButtonClasses = "bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] hover:enabled:bg-[#dadce0]";
    const deleteButtonClasses = "bg-[#fce8e6] text-[#c5221f] border border-[#f4aca9] mr-auto hover:enabled:bg-[#fAD0CC]";

    return (
        // .api-key-modal-overlay
        <div className="fixed inset-0 w-full h-full bg-black/60 flex justify-center items-center z-[1000]">
            {/* .api-key-modal-content */}
            <div className="bg-white px-[30px] py-[25px] rounded-lg shadow-[0_5px_15px_rgba(0,0,0,0.3)] w-[90%] max-w-[500px] font-sans">
                {/* .api-key-modal-content h3 */}
                <h3 className="mt-0 mb-[15px] text-[#333] font-medium text-lg">Set Your Gemini API Key</h3>
                {/* .api-key-modal-content p */}
                <p className="mb-[15px] text-[0.95em] leading-[1.6] text-[#555]">
                    To use the chat features, please provide your Google Gemini API key.
                    You can obtain one from{' '}
                    {/* .api-key-modal-content a */}
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1a73e8] no-underline hover:underline"
                    >
                        Google AI Studio
                    </a>.
                    Ensure your key has billing enabled for the models you intend to use.
                </p>
                <form onSubmit={handleSubmit}>
                    {/* .api-key-modal-content .form-group */}
                    <div className="mb-5">
                        {/* .api-key-modal-content label */}
                        <label htmlFor="geminiApiKey" className="block mb-[6px] text-[0.9em] text-[#5f6368] font-medium">
                            Gemini API Key:
                        </label>
                        {/* .api-key-modal-content input[type="password"] */}
                        <input
                            type="password"
                            id="geminiApiKey"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key"
                            disabled={isLoading}
                            required
                            className="w-full px-3 py-2.5 border border-[#dadce0] rounded-[4px] text-base focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                        />
                    </div>
                    {/* .modal-error */}
                    {error && <p className="text-[#c5221f] text-[0.9em] mt-[-10px] mb-[15px]">{error}</p>}
                    {/* .modal-success */}
                    {successMessage && <p className="text-[#137333] text-[0.9em] mt-[-10px] mb-[15px]">{successMessage}</p>}
                    {/* .modal-actions */}
                    <div className="flex justify-end gap-[10px] mt-5">
                        <button
                            type="submit"
                            disabled={isLoading || !apiKey.trim()}
                            className={`${modalButtonBaseClasses} ${primaryButtonClasses}`}
                        >
                            {isLoading ? 'Submitting...' : 'Save API Key'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteKey}
                            disabled={isLoading}
                            className={`${modalButtonBaseClasses} ${deleteButtonClasses}`}
                        >
                            {isLoading ? 'Processing...' : 'Remove Key'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className={`${modalButtonBaseClasses} ${secondaryButtonClasses}`}
                        >
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApiKeyModal;