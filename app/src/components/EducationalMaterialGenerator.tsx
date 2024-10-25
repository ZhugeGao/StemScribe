import React, { useState } from 'react';
import { generateMaterial, evaluateMaterial } from '../services/llmService';

type ModelType = 'llama2' | 'llama3' | 'mistral';

const EducationalMaterialGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelType>('llama3'); // default model
  const [generatedText, setGeneratedText] = useState('');
  const [comprehensibilityScore, setComprehensibilityScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setError(null);
      const material = await generateMaterial(prompt, model);
      setGeneratedText(material);
      const score = await evaluateMaterial(material, model);
      setComprehensibilityScore(score);
    } catch (error) {
      setError('An error occurred while generating or evaluating the material.');
      console.error(error);
    }
  };

  return (
    <div>
      <h1>STEM Educational Material Generator</h1>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt here"
      />
      <select value={model} onChange={(e) => setModel(e.target.value as ModelType)}>
        <option value="llama2">Llama 2</option>
        <option value="llama3">Llama 3 (Default)</option>
        <option value="mistral">Mistral</option>
      </select>
      <button onClick={handleGenerate}>Generate</button>
      <textarea
        value={generatedText}
        onChange={(e) => setGeneratedText(e.target.value)}
        rows={10}
        cols={50}
      />
      <p>Comprehensibility Score: {comprehensibilityScore}</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default EducationalMaterialGenerator;