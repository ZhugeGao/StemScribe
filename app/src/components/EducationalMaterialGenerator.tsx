import React, { useState } from 'react';
import { generateMaterial, evaluateMaterial } from '../services/llmService';
import './EducationalMaterialGenerator.css'; // We'll create this CSS file

type ModelType = 'llama2' | 'llama3' | 'mistral';

interface DatasetEntry {
  prompt: string;
  generatedText: string;
  model: ModelType;
  comprehensibilityScore: number;
  timestamp: string;
}

const EducationalMaterialGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelType>('llama3');
  const [generatedText, setGeneratedText] = useState('');
  const [comprehensibilityScore, setComprehensibilityScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dataset, setDataset] = useState<DatasetEntry[]>([]);

  const handleGenerate = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const material = await generateMaterial(prompt, model);
      setGeneratedText(material);
      const score = await evaluateMaterial(material, model);
      setComprehensibilityScore(score);

      // Add the new entry to the dataset
      const newEntry: DatasetEntry = {
        prompt,
        generatedText: material,
        model,
        comprehensibilityScore: score,
        timestamp: new Date().toISOString(),
      };
      setDataset([...dataset, newEntry]);
    } catch (error) {
      setError('An error occurred while generating or evaluating the material.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(dataset, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'educational_material_dataset.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="container">
      <h1 className="title">STEM Educational Material Generator</h1>
      <div className="input-section">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here"
          className="prompt-input"
        />
        <select 
          value={model} 
          onChange={(e) => setModel(e.target.value as ModelType)}
          className="model-select"
        >
          <option value="llama2">Llama 2</option>
          <option value="llama3">Llama 3 (Default)</option>
          <option value="mistral">Mistral</option>
        </select>
        <button onClick={handleGenerate} disabled={isLoading} className="generate-button">
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
      </div>
      <div className="output-section">
        <textarea
          value={generatedText}
          onChange={(e) => setGeneratedText(e.target.value)}
          rows={10}
          className="generated-text"
          placeholder="Generated text will appear here..."
        />
        {comprehensibilityScore > 0 && (
          <p className="score">Comprehensibility Score: {comprehensibilityScore}</p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <button onClick={handleExport} className="export-button" disabled={dataset.length === 0}>
        Export Dataset
      </button>
    </div>
  );
};

export default EducationalMaterialGenerator;
