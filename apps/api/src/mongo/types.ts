import type { ObjectId } from "mongodb";

export type KnowledgeSourceDoc = {
  _id?: ObjectId;
  userId: string;
  schemaId?: string;
  title?: string;
  rawHtml?: string;
  createdAt: Date;
};

export type KnowledgeChunkDoc = {
  _id?: ObjectId;
  knowledgeSourceId: string;
  userId: string;
  schemaId?: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

export type SchemaMetadataDoc = {
  _id?: ObjectId;
  schemaId: string;
  userId: string;
  content: string;
  updatedAt: Date;
};
