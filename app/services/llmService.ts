import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const generateMaterial = async (prompt: string, model: 'llama2' | 'llama3' | 'mistral' = 'llama3'): Promise<string> => {
  try {
    const { data } = await axios.post<{ material: string }>(`${API_URL}/generate`, { prompt, model });
    return data.material;
  } catch (error) {
    console.error('Error generating material:', error);
    throw error;
  }
};

export const evaluateMaterial = async (material: string, model: 'llama2' | 'llama3' | 'mistral' = 'llama3'): Promise<number> => {
  try {
    const { data } = await axios.post<{ score: number }>(`${API_URL}/evaluate`, { material, model });
    return data.score;
  } catch (error) {
    console.error('Error evaluating material:', error);
    throw error;
  }
};