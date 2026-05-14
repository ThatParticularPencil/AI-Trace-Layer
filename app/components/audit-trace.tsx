"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleCheck, CircleDot, CircleX, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { TraceEvent } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

const iconMap = {
  success: CircleCheck,
  warning: TriangleAlert,
  failure: CircleX
};

const colorMap = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  failure: "border-red-200 bg-red-50 text-red-700"
};

function TraceRow({ event }: { event: TraceEvent }) {
  const [open, setOpen] = useState(false);
  const Icon = iconMap[event.status] ?? CircleDot;
  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
  const timestamp = new Date(event.timestamp).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative pl-7"
    >
      <span className="absolute left-[9px] top-8 h-full w-px bg-slate-200" />
      <span className={cn("absolute left-0 top-1 grid h-5 w-5 place-items-center rounded-full border", colorMap[event.status])}>
        <Icon className="h-3 w-3" />
      </span>
      <button
        type="button"
        onClick={() => hasMetadata && setOpen((value) => !value)}
        className="w-full rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
              [{timestamp}] {event.stage}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">{event.message}</div>
          </div>
          {hasMetadata ? <ChevronDown className={cn("mt-1 h-4 w-4 text-slate-400 transition", open && "rotate-180")} /> : null}
        </div>
      </button>
      {open && hasMetadata ? (
        <pre className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      ) : null}
    </motion.div>
  );
}

export function AuditTrace({ events, isRunning }: { events: TraceEvent[]; isRunning: boolean }) {
  return (
    <section className="flex min-h-[720px] flex-col border-l border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Live Audit Trace</h2>
            <p className="mt-1 text-xs text-slate-500">Structured events emitted by the runtime governance pipeline.</p>
          </div>
          <span className={cn("h-2.5 w-2.5 rounded-full", isRunning ? "bg-amber-500" : events.length ? "bg-emerald-500" : "bg-slate-300")} />
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-5">
        <AnimatePresence initial={false}>
          {events.map((event, index) => (
            <TraceRow key={`${event.timestamp}-${index}`} event={event} />
          ))}
        </AnimatePresence>
        {!events.length ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Submit a governance request to watch retrieval, verification, policy enforcement, and intervention events stream here.
          </div>
        ) : null}
      </div>
    </section>
  );
}
