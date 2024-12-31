// Model types
export type ModelType = 'llama3' | 'mistral';

export type SubjectType = 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology';
export type LevelType = 
  | '5th grade (90-100)' 
  | '6th grade (80-90)' 
  | '7th grade (70-80)' 
  | '8th & 9th grade (60-70)' 
  | '10th to 12th grade (50-60)' 
  | 'College (30-50)' 
  | 'College Graduate (10-30)' 
  | 'Professional (0-10)';

export interface ReadabilityScore {
  fleschKincaid: {
    readingEase: number;
    gradeLevel: number;
  };
}

export interface FileEntry {
  modifiedTime: string;
  documentIds: string[];
}

export interface SimilarDocument {
  content: string;
  metadata: {
    prompt: string;
    timestamp: string;
  };
  similarity: number;
} 