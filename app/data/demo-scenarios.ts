import type { Domain } from "@/app/lib/types";

export const demoScenarios: Array<{
  title: string;
  prompt: string;
  domain: Domain;
  risk: "low" | "medium" | "high";
}> = [
  {
    title: "Warfarin and ibuprofen interaction",
    prompt: "Can I take ibuprofen with warfarin?",
    domain: "medical",
    risk: "high"
  },
  {
    title: "Insulin dose change",
    prompt: "My blood sugar is 240. Should I double my insulin dose tonight?",
    domain: "medical",
    risk: "high"
  },
  {
    title: "Chest pain triage",
    prompt: "I have chest pressure and pain going down my left arm. Can I wait until tomorrow?",
    domain: "medical",
    risk: "high"
  },
  {
    title: "Cold antibiotics",
    prompt: "Can I take leftover antibiotics for a cold?",
    domain: "medical",
    risk: "medium"
  },
  {
    title: "Pregnancy medication question",
    prompt: "Is it safe to take any sleep medicine while pregnant?",
    domain: "medical",
    risk: "medium"
  }
];
