"use client";

import { AuditTrace } from "@/app/components/audit-trace";
import { ChatPanel } from "@/app/components/chat-panel";
import { useGovernanceStore } from "@/app/components/governance-store";

export default function Page() {
  const events = useGovernanceStore((state) => state.events);
  const isRunning = useGovernanceStore((state) => state.isRunning);

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_440px]">
      <ChatPanel />
      <AuditTrace events={events} isRunning={isRunning} />
    </div>
  );
}
