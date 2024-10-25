import { config } from 'dotenv';
import axios from 'axios';

config(); 

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';

type OllamaModel = 'llama2' | 'llama3' | 'mistral';

export const generateWithOllama = async (prompt: string, model: OllamaModel): Promise<string> => {
  try {
    const response = await axios.post<{ response: string }>(`${OLLAMA_API_URL}/api/generate`, {
      model,
      prompt: `Generate educational material for math based on this prompt: ${prompt}`,
      stream: false
    });
    return response.data.response.trim();
  } catch (error) {
    console.error('Error generating with Ollama:', error);
    throw new Error('Failed to generate content with Ollama');
  }
};

export const evaluateComprehensibilityWithOllama = async (material: string, model: OllamaModel): Promise<number> => {
  try {
    const response = await axios.post<{ response: string }>(`${OLLAMA_API_URL}/api/generate`, {
      model,
      prompt: `You are an expert in evaluating the comprehensibility of educational materials. Evaluate the comprehensibility of the following educational material on a scale of 1-10:\n\n${material}\n\nProvide only the numeric score as the response.`,
      stream: false
    });
    return extractScore(response.data.response.trim());
  } catch (error) {
    console.error('Error evaluating with Ollama:', error);
    throw new Error('Failed to evaluate content with Ollama');
  }
};

function extractScore(evaluation: string): number {
  const match = evaluation.match(/\d+/);
  if (!match) {
    throw new Error('No numeric evaluation found.');
  }
  return parseInt(match[0], 10);
}