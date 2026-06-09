import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get("AI_API_KEY") || "dummy",
      baseURL: this.config.get("AI_API_BASE"),
    });
  }

  // 1. Generate Embedding
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small", // Standard embedding model
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error("Failed to generate embedding", error);
      return [];
    }
  }

  // 2. Chunk Text
  chunkText(text: string, maxChars: number = 1000): string[] {
    const chunks: string[] = [];
    let currentChunk = "";
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChars) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
  }

  // 3. Cosine Similarity
  cosineSimilarity(vecA: number[], vecB: number[]): number {
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

  // 4. Index a document
  async indexDocument(projectId: number, documentId: number, content: string, title: string) {
    this.logger.log(`Indexing document ${documentId} for project ${projectId}`);
    const chunks = this.chunkText(content);
    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await this.generateEmbedding(chunks[i]);
      if (vector.length > 0) {
        embeddings.push({
          documentId,
          title,
          chunkIndex: i,
          text: chunks[i],
          vector,
        });
      }
    }

    // Save to ProjectAiIndex data
    const index = await this.prisma.projectAiIndex.findUnique({ where: { projectId } });
    const data: any = index?.data || {};
    const oldEmbeddings = data.documentEmbeddings || [];
    
    // Remove old embeddings for this document
    const filteredEmbeddings = oldEmbeddings.filter((e: any) => e.documentId !== documentId);
    data.documentEmbeddings = [...filteredEmbeddings, ...embeddings];

    await this.prisma.projectAiIndex.upsert({
      where: { projectId },
      create: { projectId, data },
      update: { data },
    });
    this.logger.log(`Indexed ${embeddings.length} chunks for document ${documentId}`);
  }

  // 5. Search Documents
  async searchDocuments(projectId: number, query: string, topK: number = 3) {
    const queryVector = await this.generateEmbedding(query);
    if (queryVector.length === 0) return [];

    const index = await this.prisma.projectAiIndex.findUnique({ where: { projectId } });
    if (!index || !index.data) return [];

    const data: any = index.data;
    const embeddings = data.documentEmbeddings || [];
    if (embeddings.length === 0) return [];

    const results = embeddings.map((e: any) => {
      const similarity = this.cosineSimilarity(queryVector, e.vector);
      return { ...e, similarity };
    });

    results.sort((a: any, b: any) => b.similarity - a.similarity);
    return results.slice(0, topK).map((r: any) => ({
      documentId: r.documentId,
      title: r.title,
      text: r.text,
      similarity: r.similarity
    }));
  }
}
