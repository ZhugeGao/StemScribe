import express from 'express';
import cors from 'cors';
import { generateWithOllama, evaluateComprehensibility } from './llmModels.js';
import { VectorStore } from './services/vectorStore.js';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ModelType } from '../app/src/types';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

console.log('Server setup complete');

// Create a single vector store instance
const vectorStore = new VectorStore();
console.log('Vector store instance created');

// Initialize vector store and start server
const startServer = async () => {
  try {
    console.log('Starting server initialization...');
    await vectorStore.initialize();
    await vectorStore.syncWithDataFolder();
    console.log('Vector store initialized successfully');

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

// API Routes
app.post('/api/generate', async (req: Request, res: Response) => {
  console.log(`Generating material for prompt: "${req.body.prompt.substring(0, 50)}..."`);
  const { prompt, subject, level, model, selectedContext } = req.body;
  
  try {
    if (!isValidModel(model)) {
      return res.status(400).json({ error: 'Invalid model specified' });
    }
    const material = await generateWithOllama(prompt, subject, level, model, selectedContext);
    console.log('Material generated successfully');
    res.json({ material });
  } catch (error) {
    console.error('Error generating material:', error);
    res.status(500).json({ error: 'Failed to generate material' });
  }
});

app.post('/api/evaluate', async (req: Request, res: Response) => {
  const { material} = req.body;
  try {
    const score = await evaluateComprehensibility(material);
    res.json({ score });
  } catch (error) {
    console.error('Error evaluating material:', error);
    res.status(500).json({ error: 'Failed to evaluate material' });
  }
});

app.post('/api/save-json', async (req: Request, res: Response) => {
  try {
    const { data, customPath } = req.body;
    
    // generate filename based on content if no custom path
    let filename: string;
    if (customPath?.trim()) {
      // if not ending with .json, add json to it
      filename = customPath.endsWith('.json') ? customPath : `${customPath}.json`;
    } else {
      const firstTenWords = data.generatedText
        .split(/\s+/)        
        .slice(0, 10)        
        .join(' ')           
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')  // replace with underscore
        .replace(/^_+|_+$/g, '')      // Remove extra underscores
        .substring(0, 100);           // maximum 100 characters, extra safety
      
      filename = `${firstTenWords}.json`;
    }
    
    const dataDir = path.resolve(__dirname, '..', 'data');
    const filepath = path.join(dataDir, filename);
    
    // If file exists then compare content
    if (fs.existsSync(filepath)) {
      const existingContent = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      if (existingContent.generatedText === data.generatedText) {
        return res.json({ 
          success: true, 
          filepath,
          message: `File already exists at ${filepath}`
        });
      }
      // If content is different, update the file
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2)); // write file Json
      return res.json({
        success: true,
        filepath,
        message: `Updated existing file at ${filepath}`
      });
    }
    

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      filepath,
      message: `Successfully saved to ${filepath}`
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown server error'
    });
  }
});

app.post('/api/find-similar', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const documents = await vectorStore.findSimilar(prompt);
    res.json({ documents });
  } catch (error) {
    console.error('Error finding similar documents:', error);
    res.status(500).json({ error: 'Failed to find similar documents' });
  }
});

app.post('/api/sync-index', async (_req: Request, res: Response) => {
  try {
    await vectorStore.syncWithDataFolder();
    res.json({ 
      success: true, 
      message: 'Vector store index synchronized successfully'
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to sync index'
    });
  }
});

function isValidModel(model: unknown): model is ModelType {
  return typeof model === 'string' && ['llama3', 'mistral'].includes(model);
}

startServer().catch(error => {
  console.error('Fatal error during server startup:', error);
  process.exit(1);
});