import { detectDomain } from "@/app/lib/domain";
import { getOpenAI } from "@/app/lib/openai";
import { prisma } from "@/app/lib/prisma";
import { retrieveDocuments } from "@/app/lib/retrieval";
import { clamp } from "@/app/lib/utils";
import type {
  Domain,
  GovernanceResult,
  PolicyDecision,
  RetrievedDocument,
  RiskResult,
  TraceEvent,
  VerificationResult
} from "@/app/lib/types";

type Emit = (event: TraceEvent) => Promise<void> | void;

function now() {
  return new Date().toISOString();
}

async function pause(ms = 280) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function trace(stage: TraceEvent["stage"], status: TraceEvent["status"], message: string, metadata?: Record<string, unknown>) {
  return {
    timestamp: now(),
    stage,
    status,
    message,
    metadata
  } satisfies TraceEvent;
}

function sourceBlock(sources: RetrievedDocument[]) {
  return sources.map((doc) => `[${doc.title} | ${doc.source}]\n${doc.content}`).join("\n\n");
}

async function generateResponse(query: string, sources: RetrievedDocument[]) {
  const prompt = `You are producing a governed enterprise answer from retrieved context.
Use only the supplied trusted context. Cite source titles inline in parentheses.
If the context is insufficient, say so and recommend qualified professional verification.

User question:
${query}

Trusted context:
${sourceBlock(sources)}`;

  const openai = getOpenAI();

  if (!openai) {
    const riskyWarfarin = query.toLowerCase().includes("warfarin") && query.toLowerCase().includes("ibuprofen");
    return {
      prompt,
      rawResponse: riskyWarfarin
        ? "Ibuprofen is generally safe to take with warfarin for short periods. Use the lowest effective dose and monitor for bruising."
        : `The retrieved clinical sources indicate this depends on patient-specific risk factors. ${sources
            .map((source) => `(${source.title})`)
            .join(" ")} A qualified clinician should verify the safest next step.`,
      tokenCounts: { prompt: Math.round(prompt.length / 4), completion: 42 },
      model: "offline-demo-generator"
    };
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You write concise, cautious, source-grounded governed responses." },
      { role: "user", content: prompt }
    ]
  });

  return {
    prompt,
    rawResponse: completion.choices[0]?.message.content ?? "",
    tokenCounts: completion.usage ?? null,
    model: completion.model
  };
}

function fallbackVerification(response: string, sources: RetrievedDocument[]): VerificationResult {
  const evidence = sources.map((source) => `${source.title} ${source.content}`.toLowerCase()).join(" ");
  const unsupported: string[] = [];
  const missing: string[] = [];
  const contradictions: string[] = [];
  const lower = response.toLowerCase();

  if (lower.includes("generally safe") && evidence.includes("increased")) {
    unsupported.push("Ibuprofen is generally safe with warfarin");
    contradictions.push("Trusted sources describe increased bleeding risk with NSAIDs and warfarin.");
  }
  if (lower.includes("warfarin") && !lower.includes("bleeding")) {
    missing.push("Bleeding risk not mentioned");
  }
  if (!response.includes("(")) {
    unsupported.push("Response does not cite retrieved source titles inline.");
  }

  const penalty = unsupported.length * 0.15 + missing.length * 0.12 + contradictions.length * 0.13;
  return {
    grounding_score: clamp(0.86 - penalty),
    unsupported_claims: unsupported,
    missing_caveats: missing,
    contradictions
  };
}

async function verifyGrounding(response: string, sources: RetrievedDocument[]) {
  const openai = getOpenAI();
  const prompt = `Assess whether the generated response is fully supported by the retrieved sources.
Return strict JSON only with keys: grounding_score, unsupported_claims, missing_caveats, contradictions.
grounding_score must be a number from 0 to 1.

Retrieved sources:
${sourceBlock(sources)}

Generated response:
${response}`;

  if (!openai) return fallbackVerification(response, sources);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a strict grounding verifier for regulated AI responses." },
        { role: "user", content: prompt }
      ]
    });
    const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}") as VerificationResult;
    return {
      grounding_score: clamp(Number(parsed.grounding_score ?? 0)),
      unsupported_claims: Array.isArray(parsed.unsupported_claims) ? parsed.unsupported_claims : [],
      missing_caveats: Array.isArray(parsed.missing_caveats) ? parsed.missing_caveats : [],
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : []
    };
  } catch {
    return fallbackVerification(response, sources);
  }
}

function assessRisk(query: string, response: string, domain: Domain, verification: VerificationResult): RiskResult {
  const text = `${query} ${response}`.toLowerCase();
  const signals: string[] = [];
  let risk = 1 - verification.grounding_score;

  if (domain === "medical") {
    risk += 0.18;
    signals.push("regulated medical domain");
  }
  if (/\b(always|never|guaranteed|safe|cure|definitely|double your dose)\b/.test(text)) {
    risk += 0.18;
    signals.push("dangerous certainty language");
  }
  if (/\b\d+\s?(mg|mcg|units|pills|tablets)\b/.test(text)) {
    risk += 0.14;
    signals.push("specific dosage language");
  }
  if (!response.includes("(")) {
    risk += 0.16;
    signals.push("missing inline citations");
  }
  if (verification.unsupported_claims.length > 0) {
    risk += verification.unsupported_claims.length * 0.12;
    signals.push("unsupported claims detected");
  }
  if (verification.contradictions.length > 0) {
    risk += verification.contradictions.length * 0.18;
    signals.push("source contradiction detected");
  }

  const hallucinationRisk = clamp(risk);
  const severity = hallucinationRisk >= 0.68 ? "high" : hallucinationRisk >= 0.38 ? "medium" : "low";

  return { hallucinationRisk, severity, signals };
}

function decidePolicy(verification: VerificationResult, risk: RiskResult): PolicyDecision {
  if (verification.grounding_score < 0.25 && risk.severity === "high") {
    return { action: "BLOCK", reason: "Response is severely ungrounded in a high-risk domain." };
  }
  if (verification.grounding_score < 0.55 && risk.severity === "high") {
    return { action: "REWRITE", reason: "High-risk medical response requires runtime correction before delivery." };
  }
  if (verification.grounding_score < 0.7 || risk.severity === "medium") {
    return { action: "WARN", reason: "Response is partially grounded and should be delivered with governance warning." };
  }
  return { action: "ALLOW", reason: "Response meets grounding and severity thresholds." };
}

async function intervene(query: string, failedResponse: string, sources: RetrievedDocument[], verification: VerificationResult, policy: PolicyDecision) {
  if (policy.action === "BLOCK") {
    return "This response was blocked by runtime governance because the draft was not sufficiently grounded for a high-risk medical question. Please consult a qualified healthcare professional or urgent care service for individualized guidance.";
  }

  if (policy.action !== "REWRITE") return failedResponse;

  const openai = getOpenAI();
  const prompt = `Rewrite the failed response using ONLY supported claims from the trusted sources.
Be cautious, mention uncertainty, recommend professional verification, and cite source titles inline.

Original query:
${query}

Retrieved sources:
${sourceBlock(sources)}

Failed response:
${failedResponse}

Verifier findings:
${JSON.stringify(verification, null, 2)}`;

  if (!openai) {
    return `The retrieved sources do not support treating ibuprofen as generally safe with warfarin. Warfarin can cause major bleeding, and FDA and Mayo Clinic materials note that NSAIDs such as ibuprofen can increase bleeding risk when used with blood thinners (Warfarin Medication Guide: Bleeding Risk; Ibuprofen Safety Considerations). Ask a clinician or pharmacist before taking ibuprofen with warfarin, and seek urgent help for unusual bleeding, black stools, severe headache, weakness, or other concerning symptoms.`;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.15,
    messages: [
      { role: "system", content: "You are a runtime intervention layer that rewrites unsafe LLM output." },
      { role: "user", content: prompt }
    ]
  });

  return completion.choices[0]?.message.content ?? failedResponse;
}

export async function runGovernancePipeline(query: string, emit: Emit): Promise<GovernanceResult> {
  const traces: TraceEvent[] = [];
  const push = async (event: TraceEvent) => {
    traces.push(event);
    await emit(event);
    await pause();
  };

  await push(trace("input", "success", "Inbound request captured", { query }));

  const domain = detectDomain(query);
  await push(trace("input", domain === "general" ? "success" : "warning", `Domain detected: ${domain}`, { domain }));

  const sources = retrieveDocuments(query);
  await push(
    trace("retrieval", "success", `Retrieved ${sources.length} trusted sources`, {
      sources: sources.map((source) => ({
        id: source.id,
        title: source.title,
        source: source.source,
        similarity: Number(source.similarity.toFixed(3))
      }))
    })
  );

  const generation = await generateResponse(query, sources);
  await push(
    trace("generation", "success", "Initial model response generated", {
      model: generation.model,
      tokenCounts: generation.tokenCounts,
      rawPreview: generation.rawResponse.slice(0, 180)
    })
  );

  const verification = await verifyGrounding(generation.rawResponse, sources);
  await push(
    trace("verification", verification.grounding_score < 0.65 ? "warning" : "success", `Grounding score: ${verification.grounding_score.toFixed(2)}`, {
      unsupportedClaims: verification.unsupported_claims,
      missingCaveats: verification.missing_caveats,
      contradictions: verification.contradictions
    })
  );

  const risk = assessRisk(query, generation.rawResponse, domain, verification);
  await push(
    trace("verification", risk.severity === "high" ? "warning" : "success", `Risk severity: ${risk.severity}`, {
      hallucinationRisk: Number(risk.hallucinationRisk.toFixed(2)),
      signals: risk.signals
    })
  );

  const policy = decidePolicy(verification, risk);
  await push(trace("policy", policy.action === "ALLOW" ? "success" : "warning", `Policy triggered: ${policy.action.toLowerCase()}`, policy));

  const finalResponse = await intervene(query, generation.rawResponse, sources, verification, policy);
  await push(
    trace("intervention", policy.action === "ALLOW" ? "success" : "warning", policy.action === "ALLOW" ? "No intervention required" : "Runtime intervention applied", {
      action: policy.action
    })
  );

  await push(trace("output", "success", "Governed response released", { action: policy.action }));

  const conversation = await prisma.conversation.create({
    data: {
      title: query.slice(0, 80),
      domain,
      messages: {
        create: [
          { role: "user", content: query },
          { role: "assistant", content: finalResponse, rawContent: generation.rawResponse }
        ]
      },
      traceEvents: {
        create: traces.map((event) => ({
          timestamp: new Date(event.timestamp),
          stage: event.stage,
          status: event.status,
          message: event.message,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null
        }))
      },
      verification: {
        create: {
          groundingScore: verification.grounding_score,
          unsupportedClaims: JSON.stringify(verification.unsupported_claims),
          missingCaveats: JSON.stringify(verification.missing_caveats),
          contradictions: JSON.stringify(verification.contradictions),
          severity: risk.severity,
          hallucinationRisk: risk.hallucinationRisk
        }
      },
      policyAction: {
        create: {
          action: policy.action,
          reason: policy.reason
        }
      }
    }
  });

  return {
    conversationId: conversation.id,
    query,
    domain,
    finalResponse,
    rawResponse: generation.rawResponse,
    sources,
    traces,
    verification,
    risk,
    policy
  };
}
