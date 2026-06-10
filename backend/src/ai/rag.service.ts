import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";
import { AiLogger } from "./ai-logger.util";

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    let apiBase = this.config.get("AI_API_BASE") || "https://api.ai-box.vn/v1";
    if (apiBase && !apiBase.endsWith("/v1") && !apiBase.endsWith("/v1/")) {
      apiBase = apiBase.replace(/\/$/, "") + "/v1";
    }
    this.openai = new OpenAI({
      apiKey: this.config.get("AI_API_KEY") || "dummy",
      baseURL: apiBase,
    });
  }

  // 1. Generate Embedding
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small", // Standard embedding model
        input: text,
      });
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "embeddings",
        request: { model: "text-embedding-3-small", inputLength: text.length },
        response: { embeddingLength: response.data[0]?.embedding?.length || 0 },
        durationMs,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      AiLogger.log({
        type: "embeddings",
        request: { model: "text-embedding-3-small", inputLength: text.length },
        error: error.message || error,
        durationMs,
      });
      this.logger.error("Failed to generate embedding", error);
      return [];
    }
  }

  // 2. Chunk Text with Overlap
  chunkText(text: string, maxChars: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    
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
    
    return matchCount / queryWords.size;
  }

  // 4. Generate Document Summary
  async generateDocumentSummary(content: string, title: string): Promise<string> {
    const prompt = `Bạn là một AI Agent phân tích tài liệu chuyên nghiệp. 
Hãy tóm tắt tài liệu "${title}" sau đây một cách cô đọng nhưng đầy đủ thông tin bằng tiếng Việt (khoảng 150-250 từ).
Tập trung vào:
- Loại tài liệu (ví dụ: Yêu cầu khách hàng, Đặc tả nghiệp vụ, API, Thiết kế...).
- Mục tiêu chính của tài liệu.
- Các module nghiệp vụ hoặc chức năng cốt lõi được đề cập.
- Các quy định, ràng buộc kỹ thuật hoặc lưu ý đặc biệt (nếu có).

Nội dung tài liệu:
${content.slice(0, 10000)}

Tóm tắt của bạn (Trả về văn bản thuần túy, không có định dạng markdown tiêu đề):`;

    const startTime = Date.now();
    try {
      const model = this.config.get("AI_MODEL", "deepseek-v4-pro[1m]");
      const response = await this.openai.chat.completions.create({
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
  async indexDocument(projectId: number, documentId: number, content: string, title: string) {
    this.logger.log(`Indexing document ${documentId} for project ${projectId}`);
    
    // Generate chunks with overlap & embeddings
    const chunks = this.chunkText(content, 1000, 200);
    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await this.generateEmbedding(chunks[i]);
      // Save even if embedding generation fails, so we can fallback to keyword search
      embeddings.push({
        documentId,
        title,
        chunkIndex: i,
        text: chunks[i],
        vector: vector || [],
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
  async searchDocuments(projectId: number, query: string, topK: number = 3) {
    const queryVector = await this.generateEmbedding(query);

    const index = await this.prisma.projectAiIndex.findUnique({ where: { projectId } });
    if (!index || !index.data) return [];

    const data: any = index.data;
    const embeddings = data.documentEmbeddings || [];
    if (embeddings.length === 0) return [];

    let results = [];

    if (queryVector.length > 0) {
      // Use Vector Cosine Similarity
      this.logger.log(`Using vector search for query: "${query}"`);
      results = embeddings.map((e: any) => {
        const similarity = this.cosineSimilarity(queryVector, e.vector);
        return { ...e, similarity };
      });
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
