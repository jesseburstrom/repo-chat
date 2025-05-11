// gemini-repomix-ui/src/ApiKeyModal.tsx
import React, { useState } from 'react';
import * as api from './services/api';
import './ApiKeyModal.css'; // Create this CSS file

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
            setApiKey(''); // Clear field on success
            onKeySubmitted(); // Notify parent
            // Optionally auto-close after a delay: setTimeout(onClose, 2000);
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

    return (
        <div className="api-key-modal-overlay">
            <div className="api-key-modal-content">
                <h3>Set Your Gemini API Key</h3>
                <p>
                    To use the chat features, please provide your Google Gemini API key.
                    You can obtain one from{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                        Google AI Studio
                    </a>.
                    Ensure your key has billing enabled for the models you intend to use.
                </p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="geminiApiKey">Gemini API Key:</label>
                        <input
                            type="password" // Use password type for masking
                            id="geminiApiKey"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key"
                            disabled={isLoading}
                            required
                        />
                    </div>
                    {error && <p className="modal-error">{error}</p>}
                    {successMessage && <p className="modal-success">{successMessage}</p>}
                    <div className="modal-actions">
                        <button type="submit" disabled={isLoading || !apiKey.trim()}>
                            {isLoading ? 'Submitting...' : 'Save API Key'}
                        </button>
                        <button type="button" onClick={handleDeleteKey} disabled={isLoading} className="delete-button">
                            {isLoading ? 'Processing...' : 'Remove Key'}
                        </button>
                        <button type="button" onClick={onClose} disabled={isLoading}>
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApiKeyModal;