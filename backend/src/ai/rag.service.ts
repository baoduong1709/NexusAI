import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";
import { AiLogger } from "./ai-logger.util";

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private embeddingUnavailableModel?: string;
  private embeddingUnavailableUntil = 0;
  private embeddingProbeLock?: Promise<void>;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private async getSystemConfig(
    key: string,
    defaultValue: string,
  ): Promise<string> {
    try {
      const stored = await this.prisma.systemConfig.findUnique({
        where: { key },
      });
      return stored?.value || defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private async getOpenAIClient(): Promise<OpenAI> {
    const apiKey = await this.getSystemConfig(
      "AI_API_KEY",
      this.config.get("AI_API_KEY", ""),
    );
    let apiBase = await this.getSystemConfig(
      "AI_API_BASE",
      this.config.get("AI_API_BASE", "https://api.ai-box.vn/v1"),
    );
    if (apiBase && !apiBase.endsWith("/v1") && !apiBase.endsWith("/v1/")) {
      apiBase = apiBase.replace(/\/$/, "") + "/v1";
    }

    return new OpenAI({
      apiKey,
      baseURL: apiBase,
    });
  }

  // 1. Generate Embedding
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();
    const model = await this.getSystemConfig(
      "AI_EMBEDDING_MODEL",
      this.config.get("AI_EMBEDDING_MODEL", "text-embedding-3-small"),
    );
    if (["disabled", "none", "off"].includes(model.trim().toLowerCase())) {
      return [];
    }
    if (
      this.embeddingUnavailableModel === model &&
      Date.now() < this.embeddingUnavailableUntil
    ) {
      return [];
    }

    while (this.embeddingProbeLock) {
      await this.embeddingProbeLock;
      if (
        this.embeddingUnavailableModel === model &&
        Date.now() < this.embeddingUnavailableUntil
      ) {
        return [];
      }
    }

    let releaseProbe: () => void = () => undefined;
    this.embeddingProbeLock = new Promise<void>((resolve) => {
      releaseProbe = resolve;
    });
    try {
      const openai = await this.getOpenAIClient();
      const response = await openai.embeddings.create({
        model,
        input: text,
      });
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "embeddings",
        request: { model, inputLength: text.length },
        response: { embeddingLength: response.data[0]?.embedding?.length || 0 },
        durationMs,
      });
      this.embeddingUnavailableModel = undefined;
      this.embeddingUnavailableUntil = 0;
      return response.data[0].embedding;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "embeddings",
        request: { model, inputLength: text.length },
        error: error.message || error,
        durationMs,
      });
      const status = error?.status || error?.response?.status;
      if (status === 404 || status === 503) {
        this.embeddingUnavailableModel = model;
        this.embeddingUnavailableUntil = Date.now() + 5 * 60 * 1000;
        this.logger.warn(
          `Embedding model ${model} is unavailable; using keyword search for 5 minutes`,
        );
      } else {
        this.logger.error("Failed to generate embedding", error);
      }
      return [];
    } finally {
      this.embeddingProbeLock = undefined;
      releaseProbe();
    }
  }

  // 1.1 Generate Embeddings in Batch
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }
    const startTime = Date.now();
    const model = await this.getSystemConfig(
      "AI_EMBEDDING_MODEL",
      this.config.get("AI_EMBEDDING_MODEL", "text-embedding-3-small"),
    );
    if (["disabled", "none", "off"].includes(model.trim().toLowerCase())) {
      return [];
    }
    if (
      this.embeddingUnavailableModel === model &&
      Date.now() < this.embeddingUnavailableUntil
    ) {
      return [];
    }

    while (this.embeddingProbeLock) {
      await this.embeddingProbeLock;
      if (
        this.embeddingUnavailableModel === model &&
        Date.now() < this.embeddingUnavailableUntil
      ) {
        return [];
      }
    }

    let releaseProbe: () => void = () => undefined;
    this.embeddingProbeLock = new Promise<void>((resolve) => {
      releaseProbe = resolve;
    });

    try {
      const openai = await this.getOpenAIClient();
      const response = await openai.embeddings.create({
        model,
        input: texts,
      });
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "embeddings_batch",
        request: { model, count: texts.length },
        response: { count: response.data.length },
        durationMs,
      });
      this.embeddingUnavailableModel = undefined;
      this.embeddingUnavailableUntil = 0;
      
      // Sort by index to make sure they match original order
      return response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "embeddings_batch",
        request: { model, count: texts.length },
        error: error.message || error,
        durationMs,
      });
      const status = error?.status || error?.response?.status;
      if (status === 404 || status === 503) {
        this.embeddingUnavailableModel = model;
        this.embeddingUnavailableUntil = Date.now() + 5 * 60 * 1000;
        this.logger.warn(
          `Embedding model ${model} is unavailable; using keyword search for 5 minutes`,
        );
      } else {
        this.logger.error("Failed to generate batch embeddings", error);
      }
      return [];
    } finally {
      this.embeddingProbeLock = undefined;
      releaseProbe();
    }
  }

  // 2. Chunk Text with Overlap
  chunkText(text: string, maxChars: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const rawSentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sentences: string[] = [];

    // Split sentences that exceed maxChars to prevent huge chunks
    for (const sentence of rawSentences) {
      if (sentence.length <= maxChars) {
        sentences.push(sentence);
      } else {
        let remaining = sentence;
        while (remaining.length > 0) {
          let sliceLen = maxChars;
          if (remaining.length > maxChars) {
            const lastSpace = remaining.lastIndexOf(" ", maxChars);
            if (lastSpace > maxChars * 0.7) {
              sliceLen = lastSpace;
            }
          }
          sentences.push(remaining.slice(0, sliceLen).trim());
          remaining = remaining.slice(sliceLen).trim();
        }
      }
    }
    
    let currentIndex = 0;
    while (currentIndex < sentences.length) {
      let currentChunk = "";
      let lastAddedIndex = currentIndex;
      
      for (let i = currentIndex; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (currentChunk.length > 0 && currentChunk.length + sentence.length > maxChars) {
          break;
        }
        currentChunk += (currentChunk ? " " : "") + sentence;
        lastAddedIndex = i;
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // Calculate next starting index using overlap
      let nextIndex = lastAddedIndex + 1;
      let overlapChars = 0;
      for (let i = lastAddedIndex; i >= currentIndex; i--) {
        overlapChars += sentences[i].length + 1;
        if (overlapChars > overlap) {
          nextIndex = i; // start from this sentence next time
          break;
        }
      }
      
      // If we couldn't progress, force progress
      if (nextIndex <= currentIndex) {
        nextIndex = currentIndex + 1;
      }
      currentIndex = nextIndex;
    }
    
    return chunks;
  }

  // 3. Cosine Similarity
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 3.1 Normalize string for fallback keyword search (lowercase, remove Vietnamese diacritics)
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^\w\s]/g, " ")       // Remove special characters
      .replace(/\s+/g, " ")           // Collapse multiple spaces
      .trim();
  }

  // 3.2 Simple Jaccard/TF-IDF similarity score for keyword search
  private getKeywordSimilarity(query: string, text: string): number {
    const queryNorm = this.normalizeText(query);
    const textNorm = this.normalizeText(text);
    
    if (!queryNorm || !textNorm) return 0;
    
    const queryWords = new Set(queryNorm.split(" ").filter(w => w.length > 1));
    const textWords = textNorm.split(" ").filter(w => w.length > 1);
    
    if (queryWords.size === 0) return 0;
    
    let matchCount = 0;
    for (const word of queryWords) {
      if (textWords.includes(word)) {
        const occurrences = textWords.filter(w => w === word).length;
        matchCount += 1 + (occurrences * 0.1); // weight exact matching and frequency
      }
    }
    
    return Math.min(1, matchCount / queryWords.size);
  }

  // 4. Generate Document Summary
  async generateDocumentSummary(content: string, title: string): Promise<string> {
    const prompt = `You are a professional document analysis AI Agent.
Summarize the following document "${title}" concisely but with complete information in Vietnamese (around 150-250 words).
Focus on:
- Document type (e.g., Client Requirements, Business Specification, API, Design...).
- Main objective of the document.
- Core business modules or features mentioned.
- Any regulations, technical constraints, or special notes (if any).

Document content:
${content.slice(0, 10000)}

Your summary (Return plain text, without markdown headers format):`;

    const startTime = Date.now();
    try {
      const defaultSummaryModel =
        this.config.get<string>("AI_SUMMARY_MODEL") ||
        this.config.get<string>("AI_MODEL") ||
        "deepseek-v4-flash[1m]";
      const model = await this.getSystemConfig(
        "AI_SUMMARY_MODEL",
        defaultSummaryModel,
      );
      const openai = await this.getOpenAIClient();
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });
      const durationMs = Date.now() - startTime;
      const summaryText = response.choices[0]?.message?.content?.trim() || "Không thể tạo tóm tắt.";
      AiLogger.log({
        type: "summary",
        request: { model, title, promptLength: prompt.length },
        response: summaryText,
        durationMs,
      });
      return summaryText;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "summary",
        request: { title },
        error: error.message || error,
        durationMs,
      });
      this.logger.error(`Failed to generate summary for document ${title}`, error);
      return "Không thể tạo tóm tắt do lỗi hệ thống.";
    }
  }

  // 5. Index a document
  async indexDocument(projectId: string, documentId: number, content: string, title: string) {
    this.logger.log(`Indexing document ${documentId} for project ${projectId}`);
    
    // Generate chunks with overlap & embeddings in batch
    const chunks = this.chunkText(content, 1000, 200);
    const vectors = await this.generateEmbeddings(chunks);
    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      embeddings.push({
        documentId,
        title,
        chunkIndex: i,
        text: chunks[i],
        vector: vectors[i] || [],
      });
    }

    // Generate document summary
    const summary = await this.generateDocumentSummary(content, title);

    // Save to ProjectAiIndex data, preserving existing keys
    const index = await this.prisma.projectAiIndex.findUnique({ where: { projectId } });
    const data: any = index?.data || {};
    
    // Preserve old documentEmbeddings, remove only for this document
    const oldEmbeddings = data.documentEmbeddings || [];
    const filteredEmbeddings = oldEmbeddings.filter((e: any) => e.documentId !== documentId);
    data.documentEmbeddings = [...filteredEmbeddings, ...embeddings];

    // Preserve old documentSummaries, add/update for this document
    const summaries = data.documentSummaries || {};
    summaries[documentId] = summary;
    data.documentSummaries = summaries;

    // Update documentManifest to attach summary
    if (Array.isArray(data.documentManifest)) {
      data.documentManifest = data.documentManifest.map((doc: any) => {
        if (doc.id === documentId) {
          return { ...doc, summary };
        }
        return doc;
      });
    }

    await this.prisma.projectAiIndex.upsert({
      where: { projectId },
      create: { projectId, data },
      update: { data },
    });
    this.logger.log(`Indexed ${embeddings.length} chunks and generated summary for document ${documentId}`);
  }

  // 6. Search Documents
  async searchDocuments(projectId: string, query: string, topK: number = 3) {
    const queryVector = await this.generateEmbedding(query);

    const index = await this.prisma.projectAiIndex.findUnique({ where: { projectId } });
    if (!index || !index.data) return [];

    const data: any = index.data;
    const embeddings = data.documentEmbeddings || [];
    if (embeddings.length === 0) return [];

    let results = [];

    if (queryVector.length > 0) {
      // Check for dimension mismatch to avoid returning 0 results silently
      const firstVector = embeddings[0]?.vector;
      if (firstVector && firstVector.length > 0 && firstVector.length !== queryVector.length) {
        this.logger.warn(
          `Vector dimension mismatch (Query: ${queryVector.length}, Index: ${firstVector.length}). Falling back to keyword search.`
        );
        results = embeddings.map((e: any) => {
          const similarity = this.getKeywordSimilarity(query, e.text);
          return { ...e, similarity };
        });
      } else {
        // Use Vector Cosine Similarity
        this.logger.log(`Using vector search for query: "${query}"`);
        results = embeddings.map((e: any) => {
          const similarity = this.cosineSimilarity(queryVector, e.vector);
          return { ...e, similarity };
        });
      }
    } else {
      // Fallback: Use Keyword Search
      this.logger.log(`Embedding model unavailable/failed (503). Falling back to keyword search for query: "${query}"`);
      results = embeddings.map((e: any) => {
        const similarity = this.getKeywordSimilarity(query, e.text);
        return { ...e, similarity };
      });
    }

    results.sort((a: any, b: any) => b.similarity - a.similarity);
    // Filter out chunks with 0 similarity
    const filteredResults = results.filter((r: any) => r.similarity > 0);

    return filteredResults.slice(0, topK).map((r: any) => ({
      documentId: r.documentId,
      title: r.title,
      text: r.text,
      similarity: r.similarity
    }));
  }
}
