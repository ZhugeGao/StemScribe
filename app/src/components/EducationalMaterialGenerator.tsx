import React, { useState, useEffect } from 'react';
import { generateMaterial, evaluateMaterial, saveToFile, findSimilarMaterials, syncVectorIndex } from '../services/llmService';
import './EducationalMaterialGenerator.css';
import { ModelType, SubjectType, LevelType, ReadabilityScore, SimilarDocument } from '../types';

const EducationalMaterialGenerator: React.FC = () => {
  // user input states
  const [prompt, setPrompt] = useState(() => 
    localStorage.getItem('prompt') || ''
  );
  const [model, setModel] = useState<ModelType>(() => 
    (localStorage.getItem('model') as ModelType) || 'llama3'
  );
  const [subject, setSubject] = useState<SubjectType>('Mathematics');
  const [level, setLevel] = useState<LevelType>(() =>
    (localStorage.getItem('level') as LevelType) || '5th grade (90-100)'
  );
  
  const [generatedText, setGeneratedText] = useState(() => 
    localStorage.getItem('generatedText') || ''
  );
  const [scores, setScores] = useState<ReadabilityScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>(['']);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const TYPING_TIMEOUT = 1000; // 1 second of no typing will trigger a save
  const [similarDocuments, setSimilarDocuments] = useState<SimilarDocument[]>(() => {
    const saved = localStorage.getItem('similarDocuments');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('selectedDocuments');
    return new Set(saved ? JSON.parse(saved) : []);
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);

  // save to localStorage when values change, loading after refresh no loss of data
  useEffect(() => {
    localStorage.setItem('prompt', prompt);
    localStorage.setItem('model', model);
    localStorage.setItem('level', level);
    localStorage.setItem('generatedText', generatedText);
    localStorage.setItem('similarDocuments', JSON.stringify(similarDocuments));
    localStorage.setItem('selectedDocuments', JSON.stringify(Array.from(selectedDocuments)));
  }, [prompt, model, level, generatedText, similarDocuments, selectedDocuments]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      
      const selectedContext = Array.from(selectedDocuments)
        .map(index => similarDocuments[index])
        .filter(Boolean);
      
      const material = await generateMaterial(prompt, subject, level, model, selectedContext);
      setGeneratedText(material);
      setUndoStack(prev => [...prev, material]);
      setRedoStack([]);
      
      const evaluationScores = await evaluateMaterial(material);
      setScores(evaluationScores);
    } catch (error) {
      setError('An error occurred while generating or evaluating the material.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeneratedText(e.target.value);
    
    // remove any existing timeout before setting a new one
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      const currentText = e.target.value;
      const previousText = undoStack[undoStack.length - 1];

      // Only add to undo stack if there's a meaningful change
      if (currentText !== previousText) {
        setUndoStack(prev => [...prev, currentText]);
        setRedoStack([]); 
      }
    }, TYPING_TIMEOUT);

    setTypingTimeout(timeout);
  };

  
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  // Keep the blur handler as a backup
  const handleTextBlur = () => {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    const currentText = generatedText;
    const previousText = undoStack[undoStack.length - 1];

    if (currentText !== previousText) {
      setUndoStack(prev => [...prev, currentText]); 
      setRedoStack([]);
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 1) {  // at least 2 items to undo
      const currentStack = [...undoStack]; // new array for immutability
      const currentText = currentStack.pop()!; 
      const previousText = currentStack[currentStack.length - 1];  
      
      setRedoStack(prev => [...prev, currentText]); // add currentText to redo stack
      setGeneratedText(previousText);
      setUndoStack(currentStack);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) { // at least 1 item to redo
      const currentRedoStack = [...redoStack];
      const nextText = currentRedoStack.pop()!;
      
      setUndoStack(prev => [...prev, nextText]);
      setGeneratedText(nextText);
      setRedoStack(currentRedoStack);
    }
  };

  const handleEvaluate = async () => {
    if (!generatedText.trim()) {
      setError('Please generate or enter some text to evaluate.');
      return;
    }
    
    try {
      setError(null);
      setIsEvaluating(true);
      const evaluationScores = await evaluateMaterial(generatedText);
      setScores(evaluationScores);
    } catch (error) {
      setError('An error occurred while evaluating the material.');
      console.error(error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExport = async () => {
    if (!generatedText) {
      setError('Please generate or enter some text before exporting.');
      return;
    }

    setShowExportDialog(true);
  };

  const handleExportConfirm = async () => {
    try {
      let currentScores = scores;
      if (!currentScores) { // if no scores yet, trigger evaluate the material
        setError(null);
        setIsEvaluating(true);
        currentScores = await evaluateMaterial(generatedText);
        setScores(currentScores);
      }

      const saveData = {
        generatedText,
        model,
        prompt,
        scores: currentScores
      };

      setError('Attempting to save file...');
      const result = await saveToFile(saveData, exportPath);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to save file');
      }

      setError(result.message || `Successfully saved to ${result.filepath}`);
      setTimeout(() => setError(null), 3000);
      setShowExportDialog(false);
      setExportPath('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unknown error occurred';
      setError(`Error saving file: ${errorMessage}`);
      console.error('Export error:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleClear = () => {
    setPrompt('');
    setGeneratedText('');
    setScores(null);
    setError(null);
    setUndoStack(['']); // initialize with empty string as base state
    setRedoStack([]);
  };

  const handleFindSimilar = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }

    try {
      setError(null);
      setIsSearching(true);
      setSelectedDocuments(new Set());
      const documents = await findSimilarMaterials(prompt);
      setSimilarDocuments(documents);
    } catch (error) {
      setError('Failed to find similar materials.');
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDocumentSelect = (index: number) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSyncIndex = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      const result = await syncVectorIndex();
      if (prompt.trim()) { // If there's a prompt, refresh search results
        setIsSearching(true);
        await handleFindSimilar();
      }
      setError(result.message);
      setTimeout(() => setError(null), 3000);
    } catch (error) {
      setError('Failed to sync vector index');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">STEM Educational Material Generator</h1>
      <div className="input-section">
        <select 
          value={subject}
          onChange={(e) => setSubject(e.target.value as SubjectType)}
          className="subject-select"
        >
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
        </select>
        <select 
          value={level}
          onChange={(e) => setLevel(e.target.value as LevelType)}
          className="level-select"
        >
          <option value="5th grade (90-100)">5th grade (Very easy)</option>
          <option value="6th grade (80-90)">6th grade (Easy)</option>
          <option value="7th grade (70-80)">7th grade (Fairly easy)</option>
          <option value="8th & 9th grade (60-70)">8th & 9th grade (Plain English)</option>
          <option value="10th to 12th grade (50-60)">10th to 12th grade (Fairly difficult)</option>
          <option value="College (30-50)">College (Difficult)</option>
          <option value="College Graduate (10-30)">College Graduate (Very difficult)</option>
          <option value="Professional (0-10)">Professional (Extremely difficult)</option>
        </select>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your topic here"
          className="prompt-input"
        />
        <select 
          value={model} 
          onChange={(e) => setModel(e.target.value as ModelType)}
          className="model-select"
        >
          <option value="llama3">Llama 3 (Default)</option>
          <option value="mistral">Mistral</option>
        </select>
        <button 
          onClick={handleFindSimilar}
          className="search-button"
          disabled={isSearching || !prompt.trim()}
        >
          {isSearching ? 'Searching...' : 'Find Similar'}
        </button>
        <button 
          onClick={handleGenerate} 
          className="generate-button"
          disabled={isLoading || isEvaluating}
        >
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {similarDocuments.length > 0 && (
        <div className="similar-documents">
          <h3>Similar Materials Found:</h3>
          {similarDocuments.map((doc, index) => (
            <div key={index} className="similar-document">
              <div className="document-header">
                <span>Similarity: {(doc.similarity).toFixed(1)}</span>
                <span>Original Prompt: {doc.metadata.prompt}</span>
                <span>Date: {new Date(doc.metadata.timestamp).toLocaleDateString()}</span>
              </div>
              <pre className="document-content">{doc.content}</pre>
              <input
                type="checkbox"
                checked={selectedDocuments.has(index)}
                onChange={() => handleDocumentSelect(index)}
              />
            </div>
          ))}
        </div>
      )}
      <div className="output-section">
        <textarea
          value={generatedText}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          rows={10}
          className="generated-text"
          placeholder="Generated text will appear here..."
        />
        <div className="button-group">
          <button 
            onClick={handleUndo}
            className="undo-button"
            disabled={undoStack.length <= 1}
          >
            Undo
          </button>
          <button 
            onClick={handleRedo}
            className="redo-button"
            disabled={redoStack.length === 0}
          >
            Redo
          </button>
          <button 
            onClick={handleEvaluate}
            className="evaluate-button"
            disabled={isLoading || isEvaluating || !generatedText.trim()}
          >
            {isEvaluating ? 'Evaluating...' : 'Evaluate Text'}
          </button>
          <button
            onClick={handleExport}
            className="export-button"
            disabled={!generatedText.trim() || isEvaluating || isLoading }
          >
            {isEvaluating ? 'Evaluating...' : 'Export as JSON'}
          </button>
          <button
            onClick={handleClear}
            className="clear-button"
            disabled={isLoading || isEvaluating}
          >
            Clear All
          </button>
          <button 
            onClick={handleSyncIndex} 
            disabled={isSyncing || isLoading || isEvaluating || isSearching }
            className="sync-button"
          >
            {isSyncing ? 'Syncing...' : 'Sync Index'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {scores && (
          <div className="scores-section">
            <h3>Readability Scores</h3>
            <div className="score-item">
              <label>Flesch Reading Ease:</label>
              <span>{scores.fleschKincaid.readingEase.toFixed(1)}</span>
              <small>(Higher is easier to read)</small>
            </div>
            <div className="score-item">
              <label>Grade Level:</label>
              <span>{scores.fleschKincaid.gradeLevel.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
      {showExportDialog && (
        <div className="export-dialog">
          <h3>Export Options</h3>
          <input
            type="text"
            value={exportPath}
            onChange={(e) => setExportPath(e.target.value)}
            placeholder="Enter custom filename (optional)"
            className="export-path-input"
          />
          <div className="dialog-buttons">
            <button onClick={handleExportConfirm}>Export</button>
            <button onClick={() => {
              setShowExportDialog(false);
              setExportPath('');
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EducationalMaterialGenerator;
