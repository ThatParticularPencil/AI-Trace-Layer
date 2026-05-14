import type { Domain } from "@/app/lib/types";

const dictionaries: Record<Domain, string[]> = {
  medical: [
    "acetaminophen",
    "antibiotic",
    "blood",
    "chest",
    "clinic",
    "dose",
    "drug",
    "heart",
    "ibuprofen",
    "insulin",
    "medication",
    "medicine",
    "pain",
    "pregnant",
    "symptom",
    "warfarin"
  ],
  financial: ["stock", "portfolio", "loan", "tax", "investment", "mortgage", "401k", "crypto"],
  legal: ["contract", "lawsuit", "liable", "court", "tenant", "rights", "legal", "policy"],
  general: []
};

export function detectDomain(input: string): Domain {
  const text = input.toLowerCase();
  const scored = (["medical", "financial", "legal"] as Domain[]).map((domain) => ({
    domain,
    score: dictionaries[domain].filter((keyword) => text.includes(keyword)).length
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].domain : "general";
}
