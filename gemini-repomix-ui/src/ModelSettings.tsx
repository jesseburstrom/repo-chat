// gemini-repomix-ui/src/ModelSettings.tsx
import React from 'react';
// Removed: import './ModelSettings.css'; // Migrated to Tailwind

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
        // .model-settings-container
        <div className="px-[25px] py-[15px] border-b border-[#e0e0e0] bg-[#f8f9fa] flex flex-col gap-[15px]">
            {/* .model-settings-container h3 */}
            <h3 className="mt-0 mb-[5px] text-[#333] font-medium text-[1.1em]">AI Model & Usage</h3>
            {/* .model-selector-group */}
            <div className="flex items-center gap-[10px]">
                {/* .model-selector-group label */}
                <label htmlFor="modelSelect" className="text-[0.9em] text-[#5f6368] font-medium whitespace-nowrap">
                    Select Model:
                </label>
                {/* .model-selector-group select */}
                <select
                    id="modelSelect"
                    value={selectedModelCallName}
                    onChange={handleSelectChange}
                    disabled={isLoadingModels || isChatLoading || availableModels.length === 0}
                    className="flex-grow px-[10px] py-[8px] border border-[#ccc] rounded-[4px] text-[0.95rem] bg-white cursor-pointer disabled:bg-[#eee] disabled:cursor-not-allowed disabled:opacity-70"
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
            {/* .model-notes */}
            {selectedModelDetails?.notes && (
                <div className="text-[0.8em] text-[#6c757d] mt-[2px] pl-[70px]">Note: {selectedModelDetails.notes}</div>
            )}
            {/* Adding capabilities with same style */}
            {selectedModelDetails && (
                 <div className="text-[0.8em] text-[#6c757d] mt-[2px] pl-[70px]">Capabilities: {selectedModelDetails.capabilities}</div>
            )}

            {/* .stats-display */}
            <div className="text-[0.85em] text-[#333] flex flex-col gap-[5px]">
                <h4 className="font-semibold mb-1">Current Call:</h4>
                {currentCallStats ? (
                    <>
                        {/* .stat-line */}
                        <div className="flex justify-between">
                            {/* .stat-line span:first-child */}
                            <span className="font-medium text-[#5f6368]">Model Used:</span>
                            {/* .stat-line span:last-child */}
                            <span className="text-right">{currentCallStats.modelUsed || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-[#5f6368]">Input Tokens:</span>
                            <span className="text-right">{currentCallStats.inputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-[#5f6368]">Output Tokens:</span>
                            <span className="text-right">{currentCallStats.outputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-[#5f6368]">Total Tokens:</span>
                            <span className="text-right">{(currentCallStats.inputTokens + currentCallStats.outputTokens).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-[#5f6368]">Est. Cost:</span>
                            {/* .total-cost */}
                            <span className="text-right font-bold text-[#137333]">${currentCallStats.totalCost.toFixed(2)}</span>
                        </div>
                    </>
                ) : (
                    <div className="flex justify-between"><span>No call data yet.</span></div>
                )}

                <h4 className="font-semibold mb-1 mt-2">Session Totals:</h4> {/* Added mt-2 for spacing */}
                <div className="flex justify-between">
                    <span className="font-medium text-[#5f6368]">Total Input Tokens:</span>
                    <span className="text-right">{totalSessionStats.inputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-[#5f6368]">Total Output Tokens:</span>
                    <span className="text-right">{totalSessionStats.outputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-[#5f6368]">Grand Total Tokens:</span>
                    <span className="text-right">{(totalSessionStats.inputTokens + totalSessionStats.outputTokens).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-[#5f6368]">Est. Total Cost:</span>
                    <span className="text-right font-bold text-[#137333]">${totalSessionStats.totalCost.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};

export default ModelSettings;