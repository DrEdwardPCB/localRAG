import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });
  return splitter.splitText(text);
}
