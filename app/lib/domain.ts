import { getChatClient } from "@/app/lib/openai";
import type { Domain } from "@/app/lib/types";

export async function detectDomain(input: string): Promise<Domain> {
  const chat = getChatClient();
  if (!chat) return "general";

  try {
    const completion = await chat.client.chat.completions.create({
      model: chat.model,
      temperature: 0,
      messages: [
        { role: "system", content: "Classify the user's query into one of these domains: medical, financial, legal, or general. Return only the domain name in lowercase." },
        { role: "user", content: input }
      ]
    });
    const response = completion.choices[0]?.message.content?.trim().toLowerCase();
    if (response === "medical" || response === "financial" || response === "legal" || response === "general") {
      return response as Domain;
    }
  } catch (error) {
    console.error("Domain detection failed:", error);
  }
  return "general";
}
