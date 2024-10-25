import express from 'express';
import cors from 'cors';
import { generateWithOllama, evaluateComprehensibilityWithOllama } from './llmModels';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { prompt, model = 'llama2' } = req.body;
  try {
    const material = await generateWithOllama(prompt, model);
    res.json({ material });
  } catch (error) {
    console.error('Error generating material:', error);
    res.status(500).json({ error: 'Failed to generate material' });
  }
});

app.post('/api/evaluate', async (req, res) => {
  const { material, model = 'llama2' } = req.body;
  try {
    const score = await evaluateComprehensibilityWithOllama(material, model);
    res.json({ score });
  } catch (error) {
    console.error('Error evaluating material:', error);
    res.status(500).json({ error: 'Failed to evaluate material' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});