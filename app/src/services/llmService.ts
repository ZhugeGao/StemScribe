import axios from 'axios';
import type { LevelType, ModelType, ReadabilityScore, SimilarDocument, SubjectType } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const generateMaterial = async (
  prompt: string, 
  subject: SubjectType,
  level: LevelType,
  model: ModelType = 'llama3',
  selectedContext?: SimilarDocument[]
): Promise<string> => {
  try {
    // send prompt, subject, level, model, selectedContext to backend server, by POST request
    const { data } = await axios.post<{ material: string }>( // type definition for response and only get the content we want
      `${API_URL}/generate`, 
      { prompt, subject, level, model, selectedContext }
    );
    return data.material; // name material is defined in the backend server, frontend must match the backend defined name
  } catch (error) {
    console.error('Error generating material:', error);
    throw error;
  }
};

export const evaluateMaterial = async (material: string): Promise<ReadabilityScore> => {
  try {
    const { data } = await axios.post<{ score: ReadabilityScore }>(`${API_URL}/evaluate`, { material });
    return data.score;
  } catch (error) {
    console.error('Error evaluating material:', error);
    throw error;
  }
};

export const saveToFile = async (
  data: any, 
  customPath?: string
): Promise<{ success: boolean; filepath?: string; message?: string }> => {
  try {
    const response = await axios.post(`${API_URL}/save-json`, { data, customPath });
    return response.data; 
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
};

export const findSimilarMaterials = async (prompt: string): Promise<SimilarDocument[]> => {
  try {
    const { data } = await axios.post<{ documents: SimilarDocument[] }>(
      `${API_URL}/find-similar`,
      { prompt }
    );
    return data.documents;
  } catch (error) {
    console.error('Error finding similar materials:', error);
    throw error;
  }
};

export const syncVectorIndex = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.post(`${API_URL}/sync-index`);
    return response.data;
  } catch (error) {
    console.error('Error syncing index:', error);
    throw error;
  }
};