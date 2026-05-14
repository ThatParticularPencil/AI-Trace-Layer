"use client";

import { ArrowRight, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { demoScenarios } from "@/app/data/demo-scenarios";
import { Badge } from "@/app/components/badge";
import { useGovernanceStore } from "@/app/components/governance-store";
import { formatPercent } from "@/app/lib/utils";

function badgeForAction(action?: string) {
  if (action === "ALLOW") return { label: "verified", variant: "verified" as const };
  if (action === "REWRITE") return { label: "rewritten", variant: "rewritten" as const };
  if (action === "BLOCK") return { label: "blocked", variant: "blocked" as const };
  if (action === "WARN") return { label: "warning", variant: "warning" as const };
  return { label: "awaiting run", variant: "neutral" as const };
}

export function ChatPanel() {
  const { query, setQuery, run, reset, isRunning, result, error } = useGovernanceStore();
  const governanceBadge = badgeForAction(result?.policy.action);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-950">AI Trace Layer</h1>
              <p className="text-xs text-slate-500">Runtime governance, verification, and enforcement for LLM outputs.</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge>SQLite audit history</Badge>
            <Badge>local retrieval</Badge>
            <Badge>policy firewall</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-md border border-slate-200 bg-white shadow-soft">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">Governed Request</h2>
                  <p className="mt-1 text-xs text-slate-500">Input is routed through grounding, verification, policy, and intervention.</p>
                </div>
                <Badge variant={governanceBadge.variant}>{governanceBadge.label}</Badge>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label htmlFor="query" className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  User prompt
                </label>
                <textarea
                  id="query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {demoScenarios.map((scenario) => (
                    <button
                      key={scenario.title}
                      type="button"
                      onClick={() => setQuery(scenario.prompt)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    >
                      {scenario.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => run(query)}
                  disabled={isRunning}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Execute governance pipeline
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={isRunning}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>

              {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

              <section className="rounded-md border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-950">Final Governed Response</h3>
                    {result ? <Badge variant={governanceBadge.variant}>{result.policy.action}</Badge> : null}
                  </div>
                </div>
                <div className="min-h-44 p-4">
                  {result ? (
                    <div className="space-y-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{result.finalResponse}</p>
                      <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-slate-500">Grounding</div>
                          <div className="mt-1 text-lg font-semibold text-slate-950">{formatPercent(result.verification.grounding_score)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Risk</div>
                          <div className="mt-1 text-lg font-semibold text-slate-950">{formatPercent(result.risk.hallucinationRisk)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Domain</div>
                          <div className="mt-1 text-lg font-semibold capitalize text-slate-950">{result.domain}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center text-sm text-slate-500">
                      Governed output will appear after policy enforcement completes.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-950">Retrieved Sources</h3>
                </div>
                <div className="grid gap-3">
                  {(result?.sources ?? []).map((source) => (
                    <article key={source.id} className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-950">{source.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{source.source}</div>
                        </div>
                        <Badge>{formatPercent(source.similarity)}</Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-600">{source.content}</p>
                    </article>
                  ))}
                  {!result?.sources.length ? <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">No sources retrieved yet.</div> : null}
                </div>
              </section>
            </div>
          </div>

          <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-sm font-semibold text-slate-950">Enforcement Contract</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Runtime action</dt>
                <dd className="mt-1 font-medium text-slate-900">{result?.policy.action ?? "Pending"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Policy reason</dt>
                <dd className="mt-1 text-slate-700">{result?.policy.reason ?? "No policy decision has been made."}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Signals</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {(result?.risk.signals ?? ["awaiting verification"]).map((signal) => (
                    <Badge key={signal}>{signal}</Badge>
                  ))}
                </dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
