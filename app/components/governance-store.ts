"use client";

import { create } from "zustand";
import type { GovernanceResult, TraceEvent } from "@/app/lib/types";

type GovernanceState = {
  isRunning: boolean;
  query: string;
  events: TraceEvent[];
  result: GovernanceResult | null;
  error: string | null;
  setQuery: (query: string) => void;
  reset: () => void;
  run: (query: string) => Promise<void>;
};

async function readNdjson(response: Response, onItem: (item: any) => void) {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onItem(JSON.parse(line));
    }
  }

  if (buffer.trim()) onItem(JSON.parse(buffer));
}

export const useGovernanceStore = create<GovernanceState>((set) => ({
  isRunning: false,
  query: "Can I take ibuprofen with warfarin?",
  events: [],
  result: null,
  error: null,
  setQuery: (query) => set({ query }),
  reset: () => set({ events: [], result: null, error: null }),
  run: async (query) => {
    set({ isRunning: true, events: [], result: null, error: null });
    try {
      const response = await fetch("/api/governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (!response.ok) throw new Error("Governance request failed.");

      await readNdjson(response, (item) => {
        if (item.type === "trace") {
          set((state) => ({ events: [...state.events, item.event] }));
        }
        if (item.type === "result") {
          set({ result: item.result });
        }
        if (item.type === "error") {
          set({ error: item.error });
        }
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unexpected pipeline failure." });
    } finally {
      set({ isRunning: false });
    }
  }
}));
