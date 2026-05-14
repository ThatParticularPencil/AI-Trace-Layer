import { medicalDocuments } from "@/app/data/medical-documents";
import type { RetrievedDocument, TrustedDocument } from "@/app/lib/types";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "before",
  "can",
  "for",
  "from",
  "i",
  "in",
  "is",
  "it",
  "of",
  "or",
  "should",
  "the",
  "to",
  "with"
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function termVector(text: string) {
  const vector = new Map<string, number>();
  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }
  return vector;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (const value of a.values()) aMagnitude += value * value;
  for (const value of b.values()) bMagnitude += value * value;
  for (const [term, value] of a.entries()) dot += value * (b.get(term) ?? 0);

  if (aMagnitude === 0 || bMagnitude === 0) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

function enrichQuery(query: string) {
  const normalized = query.toLowerCase();
  const terms = [query];

  if (normalized.includes("warfarin") || normalized.includes("blood thinner")) {
    terms.push("anticoagulant bleeding clotting INR NSAID ibuprofen aspirin");
  }
  if (normalized.includes("ibuprofen") || normalized.includes("advil")) {
    terms.push("NSAID bleeding stomach ulcer kidney blood thinner");
  }
  if (normalized.includes("insulin") || normalized.includes("blood sugar")) {
    terms.push("diabetes medication dose monitoring clinician");
  }
  if (normalized.includes("chest") || normalized.includes("arm")) {
    terms.push("chest pain pressure emergency heart attack shortness breath");
  }

  return terms.join(" ");
}

export function retrieveDocuments(query: string, corpus: TrustedDocument[] = medicalDocuments): RetrievedDocument[] {
  const queryVector = termVector(enrichQuery(query));

  return corpus
    .map((document) => ({
      ...document,
      similarity: cosineSimilarity(queryVector, termVector(`${document.title} ${document.content}`))
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}
