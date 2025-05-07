// gemini-repomix-ui/src/ModelSettings.tsx
import React from 'react';
import './ModelSettings.css';

export interface ClientGeminiModelInfo {
    displayName: string;
    callName: string;
    capabilities: string;
    notes?: string;
}

export interface TokenStats {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    modelUsed?: string;
}

interface ModelSettingsProps {
    availableModels: ClientGeminiModelInfo[];
    selectedModelCallName: string;
    onModelChange: (modelCallName: string) => void;
    isLoadingModels: boolean;
    currentCallStats: TokenStats | null;
    totalSessionStats: TokenStats;
    isChatLoading: boolean; // To disable select during chat
}

const ModelSettings: React.FC<ModelSettingsProps> = ({
    availableModels,
    selectedModelCallName,
    onModelChange,
    isLoadingModels,
    currentCallStats,
    totalSessionStats,
    isChatLoading,
}) => {
    const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onModelChange(event.target.value);
    };

    const selectedModelDetails = availableModels.find(m => m.callName === selectedModelCallName);

    return (
        <div className="model-settings-container">
            <h3>AI Model & Usage</h3>
            <div className="model-selector-group">
                <label htmlFor="modelSelect">Select Model:</label>
                <select
                    id="modelSelect"
                    value={selectedModelCallName}
                    onChange={handleSelectChange}
                    disabled={isLoadingModels || isChatLoading || availableModels.length === 0}
                >
                    {isLoadingModels && <option value="">Loading models...</option>}
                    {!isLoadingModels && availableModels.length === 0 && <option value="">No models available</option>}
                    {availableModels.map(model => (
                        <option key={model.callName} value={model.callName}>
                            {model.displayName}
                        </option>
                    ))}
                </select>
            </div>
            {selectedModelDetails?.notes && (
                <div className="model-notes">Note: {selectedModelDetails.notes}</div>
            )}
            {selectedModelDetails && (
                 <div className="model-notes">Capabilities: {selectedModelDetails.capabilities}</div>
            )}


            <div className="stats-display">
                <h4>Current Call:</h4>
                {currentCallStats ? (
                    <>
                        <div className="stat-line"><span>Model Used:</span> <span>{currentCallStats.modelUsed || 'N/A'}</span></div>
                        <div className="stat-line"><span>Input Tokens:</span> <span>{currentCallStats.inputTokens.toLocaleString()}</span></div>
                        <div className="stat-line"><span>Output Tokens:</span> <span>{currentCallStats.outputTokens.toLocaleString()}</span></div>
                        <div className="stat-line"><span>Total Tokens:</span> <span>{(currentCallStats.inputTokens + currentCallStats.outputTokens).toLocaleString()}</span></div>
                        <div className="stat-line"><span>Est. Cost:</span> <span className="total-cost">${currentCallStats.totalCost.toFixed(6)}</span></div>
                    </>
                ) : (
                    <div className="stat-line"><span>No call data yet.</span></div>
                )}

                <h4>Session Totals:</h4>
                <div className="stat-line"><span>Total Input Tokens:</span> <span>{totalSessionStats.inputTokens.toLocaleString()}</span></div>
                <div className="stat-line"><span>Total Output Tokens:</span> <span>{totalSessionStats.outputTokens.toLocaleString()}</span></div>
                <div className="stat-line"><span>Grand Total Tokens:</span> <span>{(totalSessionStats.inputTokens + totalSessionStats.outputTokens).toLocaleString()}</span></div>
                <div className="stat-line"><span>Est. Total Cost:</span> <span className="total-cost">${totalSessionStats.totalCost.toFixed(6)}</span></div>
            </div>
        </div>
    );
};

export default ModelSettings;