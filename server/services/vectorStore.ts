import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OllamaEmbeddings } from "@langchain/ollama";
import fs from 'fs';
import { URL } from 'url';
import path from 'path';
import type { FileEntry, SimilarDocument } from '../../app/src/types';

export class VectorStore {
  private store: FaissStore | null = null;
  private fileTracker: Map<string, FileEntry> = new Map();
  private readonly baseURL: URL;
  private readonly SAVE_DIR: URL;
  private readonly DATA_DIR: URL;
  private readonly INDEX_FILE: URL;
  private readonly embeddings: OllamaEmbeddings;
  private initializationPromise: Promise<void> | null = null;
  private readonly TRACKER_FILE: URL;

  constructor(model: string = 'llama3') {
    this.baseURL = new URL('../../', import.meta.url);
    this.SAVE_DIR = new URL('vector_store/', this.baseURL);
    this.DATA_DIR = new URL('data/', this.baseURL);
    this.INDEX_FILE = new URL(`vector_store/faiss_index/`, this.baseURL);
    this.TRACKER_FILE = new URL('vector_store/document_tracker.json', this.baseURL);
    
    this.embeddings = new OllamaEmbeddings({
      model,
      baseUrl: process.env.OLLAMA_API_URL
    });
    this.loadFileTracker();
  }

  private async initializeStore() {
    console.log('Initializing directories...');
    // console.log('SAVE_DIR path:', this.SAVE_DIR.pathname);
    // console.log('DATA_DIR path:', this.DATA_DIR.pathname);

    [this.SAVE_DIR, this.DATA_DIR].forEach(dir => {
      if (!fs.existsSync(dir.pathname)) {
        fs.mkdirSync(dir.pathname, { recursive: true });
      }
    });

    if (!fs.existsSync(this.INDEX_FILE.pathname)) {
      console.log(`Creating index directory: ${this.INDEX_FILE.pathname}`); // debug
      fs.mkdirSync(this.INDEX_FILE.pathname, { recursive: true });
    }

    if (fs.existsSync(path.join(this.INDEX_FILE.pathname, 'docstore.json'))) {
      console.log('Loading existing vector store from:', this.INDEX_FILE.pathname);
      this.store = await FaissStore.load(this.INDEX_FILE.pathname, this.embeddings);
    } else {
      console.log('Creating new vector store with initialization document');
      this.store = await FaissStore.fromDocuments([{
        pageContent: "FAISS initialization document", // faiss store could not be initialized without any document
        metadata: {
          source: { type: 'manual' },
          timestamp: new Date().toISOString(),
          init: true
        }
      }], this.embeddings);
    }

    console.log('Verifying index content with data folder...');
    await this.syncWithDataFolder();
    await this.store.save(this.INDEX_FILE.pathname);
  }

  private async getDocumentCount(): Promise<number> { // get document count debugging helper
    if (!this.store) return 0;
    const results = await this.store.similaritySearchWithScore('', 1000);
    
    console.log('All documents in store:', results.map(([doc, _]) => ({
      id: doc.metadata.documentId,
      content: doc.pageContent.substring(0, 50) + '...',
      metadata: doc.metadata
    })));
    
    return results.length;
  }

  public async syncWithDataFolder() {
    if (!this.store) {
      await this.initialize();
    }
    if (!this.store) throw new Error('Vector store not initialized'); // may not be necessary

    try {
      const dataFiles = fs.readdirSync(this.DATA_DIR.pathname)
        .filter(file => file.endsWith('.json')); // filter json files
      
      let hasUpdates = false;
      
      for (const file of dataFiles) {
        const filePath = new URL(file, this.DATA_DIR);
        const fileModTime = fs.statSync(filePath.pathname).mtime.toISOString();
        const trackedFile = this.fileTracker.get(filePath.pathname);

        // If new or modified file
        if (!trackedFile || trackedFile.modifiedTime !== fileModTime) {
          hasUpdates = true;
          try {
            const content = fs.readFileSync(filePath.pathname, 'utf8');
            const jsonData = JSON.parse(content);
            const entries = Array.isArray(jsonData) ? jsonData : [jsonData];
            const validEntries = entries.filter(entry => 
              entry.generatedText?.trim().length > 0
            );

            if (validEntries.length) {
              // Remove old documents using faiss IDs before adding new ones
              if (trackedFile?.documentIds.length) {
                console.log('Removing old documents:', trackedFile.documentIds);
                await this.store?.delete({ ids: trackedFile.documentIds });
              }

              const documents = validEntries.map(entry => ({
                pageContent: entry.generatedText,
                metadata: {
                  source: {
                    type: entry.model ? 'generated' : 'manual',
                    ...(entry.model && { model: entry.model }),
                    ...(entry.prompt && { prompt: entry.prompt })
                  },
                  timestamp: new Date().toISOString(),
                  filePath: filePath.pathname,
                  lastModified: fileModTime
                }
              }));

              const addedDocs = await this.store?.addDocuments(documents);
              
              // update tracker 
              this.fileTracker.set(filePath.pathname, {
                modifiedTime: fileModTime,
                documentIds: addedDocs || []
              });
            }
          } catch (error) {
            console.error(`Error processing file ${file}:`, error);
          }
        }
      }

      const trackedFiles = Array.from(this.fileTracker.keys());
      for (const trackedPath of trackedFiles) {
        if (!fs.existsSync(trackedPath)) { // if file is deleted
          hasUpdates = true;
          const trackedFile = this.fileTracker.get(trackedPath);
          if (trackedFile?.documentIds.length) {
            console.log('Removing documents from index for deleted file:', trackedPath);
            await this.store?.delete({ ids: trackedFile.documentIds });
          }
          this.fileTracker.delete(trackedPath);
        }
      }

      if (hasUpdates) {
        await this.store.save(this.INDEX_FILE.pathname);
        this.saveFileTracker();
      }
    } catch (error) {
      console.error('Error syncing with data directory:', error);
    }
  }

  async initialize() {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeStore().catch(error => {
        this.initializationPromise = null;
        throw error;
      });
    }
    return this.initializationPromise;
  }

  private async loadFileTracker() {
    if (fs.existsSync(this.TRACKER_FILE.pathname)) {
      const trackerData = JSON.parse(fs.readFileSync(this.TRACKER_FILE.pathname, 'utf8'));
      this.fileTracker = new Map(Object.entries(trackerData));
    }
  }

  private saveFileTracker() {
    const trackerData = Object.fromEntries(this.fileTracker);
    fs.writeFileSync(this.TRACKER_FILE.pathname, JSON.stringify(trackerData, null, 2));
  }

  async findSimilar(query: string, numResults: number = 3): Promise<SimilarDocument[]> {
    try {
      if (!this.store) throw new Error('Vector store not initialized');

      if (!query.trim()) {
        return [];
      }

      const results = await this.store.similaritySearchWithScore(query, numResults);

      return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: {
          prompt: doc.metadata.source.prompt || '',
          timestamp: doc.metadata.timestamp
        },
        similarity: score
      }));
    } catch (error) {
      console.error('Error in similarity search:', error);
      return [];
    }
  }
} 