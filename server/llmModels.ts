import { config } from 'dotenv';
import axios from 'axios';
import type { ReadabilityScore, ModelType } from '../app/src/types';

config();

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';

export const generateWithOllama = async (
  prompt: string,
  subject: string,
  level: string,
  model: ModelType,
  selectedContext?: { content: string }[]
): Promise<string> => {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  try {
    // base prompt template
    const basePrompt = `Generate educational material for ${subject} targeted at ${level} level students.
      
      Consider the following guidelines:
      - Use appropriate vocabulary and complexity for the specified level
      - Include relevant examples and explanations
      - Break down complex concepts into manageable parts
      - Add practice questions if appropriate
      
      Topic: ${prompt}`;

    // If we have selected context, enhance the prompt with context
    if (selectedContext && selectedContext.length > 0) {
      console.log('Using enhanced generation with selected context:', {
        numContextDocs: selectedContext.length,
        contextSummary: selectedContext.map(doc => doc.content.substring(0, 50) + '...'),
      });

      const context = selectedContext.map(doc => doc.content).join('\n\n');
      const enhancedPrompt = `Context:
        ${context}

        Using the above context and your knowledge, ${basePrompt}`;

      const enhancedResponse = await axios.post<{ response: string }>(`${OLLAMA_API_URL}/api/generate`, {
        model,
        prompt: enhancedPrompt,
        stream: false
      });

      if (!enhancedResponse.data?.response) {
        throw new Error('Invalid enhanced response from Ollama');
      }

      return enhancedResponse.data.response.trim();
    }

    // Basic generation without context
    console.log('Using basic generation without context');
    const response = await axios.post<{ response: string }>(`${OLLAMA_API_URL}/api/generate`, {
      model,
      prompt: basePrompt,
      stream: false
    });

    if (!response.data?.response) {
      throw new Error('Invalid response from Ollama');
    }

    return response.data.response.trim();
  } catch (error) {
    console.error('Error generating content with Ollama:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate content with Ollama');
  }
};

export const evaluateComprehensibility = async (material: string): Promise<ReadabilityScore> => {
  if (!material.trim()) {
    throw new Error('Material cannot be empty');
  }

  try {
    const fleschKincaid = calculateFleschKincaid(material);
    return { fleschKincaid };
  } catch (error) {
    console.error('Error evaluating material:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to evaluate content');
  }
};

function calculateFleschKincaid(text: string): { readingEase: number; gradeLevel: number } {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length === 0) {
    throw new Error('Text contains no words');
  }

  const sentences = text.split(/[.!?]+/).filter(Boolean);
  if (sentences.length === 0) {
    throw new Error('Text contains no complete sentences');
  }

  const syllables = words.reduce((total, word) => {
    try {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '');
      const wordSyllables = countSyllables(cleanWord);
      // console.log(`Word: "${cleanWord}" - Syllables: ${wordSyllables}`);
      return total + wordSyllables;
    } catch (error) {
      console.warn(`Failed to count syllables for word "${word}":`, error);
      return total + 1;
    }
  }, 0);

  // console.log(`Total words: ${words.length}`);
  // console.log(`Total syllables: ${syllables}`);
  // console.log(`Words per sentence: ${words.length / sentences.length}`);
  // console.log(`Syllables per word: ${syllables / words.length}`);

  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllables / words.length;

  const readingEase = 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord);
  const gradeLevel = (0.39 * wordsPerSentence) + (11.8 * syllablesPerWord) - 15.59;

  return {
    readingEase: Number(readingEase.toFixed(2)),
    gradeLevel: Number(gradeLevel.toFixed(2))
  };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const matches = word.match(/[aeiouy]+/g);
  if (!matches) return 1;

  let count = matches.length;
  if (word.match(/[aeiou][^aeiou]*e$/)) count--;  // Silent e 
  if (word.match(/[aeiou]{2}/)) count--;  // Diphthongs
  
  // Common endings that add syllables, found with examples,  NOT exhaustive at all
  if (word.match(/ian$/)) count++;  // reptilian, Australian
  if (word.match(/ious$/)) count++; // suspicious, delicious
  if (word.match(/[^aeiou]ying$/)) count++; // flying, trying
  else if (word.match(/[^aeiou]ing$/)) count++; // running, jumping
  if (word.match(/tion$/)) count++; // education, motion
  if (word.match(/[^aeiou]ual$/)) count++; // actual, visual
  if (word.match(/[^aeiou]ly$/)) count++; // seemingly, quickly
  if (word.match(/[aeiou]ble$/)) count++; // admirable, possible, table

  return Math.max(1, count);
}