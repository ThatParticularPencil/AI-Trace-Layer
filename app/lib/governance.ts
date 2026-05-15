import { detectDomain } from "@/app/lib/domain";
import { getChatClient } from "@/app/lib/openai";
import { prisma } from "@/app/lib/prisma";
import { retrieveDocuments } from "@/app/lib/retrieval";
import { clamp } from "@/app/lib/utils";
import type {
  Domain,
  GovernanceResult,
  ClaimVerification,
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
  const prompt = `You are producing an evidence-aware answer that will be reviewed by a runtime governance layer before release.
Use the supplied trusted context preferentially, but you may also use general medical knowledge where appropriate.
Answer naturally and directly. Be cautious with medical advice, avoid overconfidence, and recommend qualified professional verification for patient-specific decisions.
Cite claims when possible using the supplied source titles inline in parentheses.

User question:
${query}

Trusted context:
${sourceBlock(sources)}`;

  const chat = getChatClient();

  if (!chat) {
    const riskyWarfarin = query.toLowerCase().includes("warfarin") && query.toLowerCase().includes("ibuprofen");
    return {
      prompt,
      rawResponse: riskyWarfarin
        ? "Ibuprofen is generally safe to take with warfarin for short periods. Use the lowest effective dose and monitor for bruising."
        : `The retrieved clinical sources indicate this depends on patient-specific risk factors. ${sources
            .map((source) => `(${source.title})`)
            .join(" ")} A qualified clinician should verify the safest next step.`,
      tokenCounts: { prompt: Math.round(prompt.length / 4), completion: 42 },
      model: "offline-demo-generator",
      provider: "offline"
    };
  }

  const completion = await chat.client.chat.completions.create({
    model: chat.model,
    temperature: 0.35,
    messages: [
      { role: "system", content: "You write concise, cautious, evidence-aware responses for a regulated workflow. A separate governance layer will verify your claims." },
      { role: "user", content: prompt }
    ]
  });

  return {
    prompt,
    rawResponse: completion.choices[0]?.message.content ?? "",
    tokenCounts: completion.usage ?? null,
    model: completion.model,
    provider: chat.provider
  };
}

function fallbackExtractClaims(response: string) {
  return response
    .split(/(?<=[.!?])\s+/)
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 20)
    .slice(0, 8);
}

async function extractClaims(response: string) {
  const chat = getChatClient();
  const fallback = fallbackExtractClaims(response);

  if (!chat) return fallback;

  const prompt = `Extract the factual and advisory claims from this model response.
Return strict JSON only:
{
  "claims": ["claim 1", "claim 2"]
}

Rules:
- Split compound medical assertions into separate claims.
- Include safety claims, interaction claims, dosage claims, and recommendations.
- Omit purely conversational text.
- Keep each claim short and self-contained.

Response:
${response}`;

  try {
    const completion = await chat.client.chat.completions.create({
      model: chat.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You extract auditable claims for an AI governance system." },
        { role: "user", content: prompt }
      ]
    });
    const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}") as { claims?: unknown };
    return Array.isArray(parsed.claims) ? parsed.claims.filter((claim): claim is string => typeof claim === "string").slice(0, 10) : fallback;
  } catch {
    return fallback;
  }
}

function fallbackVerifyClaims(claims: string[], sources: RetrievedDocument[]): ClaimVerification[] {
  const evidence = sources.map((source) => `${source.title} ${source.content}`.toLowerCase()).join(" ");
  return claims.map((claim) => {
    const lower = claim.toLowerCase();
    const dangerousSafeClaim = lower.includes("safe") && lower.includes("warfarin") && lower.includes("ibuprofen");
    const bleedingSupported = lower.includes("bleeding") && lower.includes("warfarin") && (lower.includes("ibuprofen") || lower.includes("nsaid"));
    const consultSupported = /consult|ask|seek|professional|clinician|doctor|pharmacist/.test(lower);
    const nsaidSupported = lower.includes("ibuprofen") && lower.includes("nsaid");
    const supported = !dangerousSafeClaim && (bleedingSupported || consultSupported || nsaidSupported || lower.split(/\s+/).some((term) => term.length > 6 && evidence.includes(term)));

    return {
      claim,
      supported,
      confidence: supported ? 0.82 : 0.24,
      evidence: supported ? sources.slice(0, 2).map((source) => source.title) : [],
      risk: lower.includes("warfarin") || lower.includes("dose") || lower.includes("safe") ? "high" : "medium",
      notes: dangerousSafeClaim ? "Contradicts retrieved evidence describing increased bleeding risk." : undefined
    };
  });
}

async function verifyClaims(claims: string[], sources: RetrievedDocument[]): Promise<ClaimVerification[]> {
  const chat = getChatClient();
  const fallback = fallbackVerifyClaims(claims, sources);

  if (!chat) return fallback;

  const prompt = `Verify each claim against the retrieved trusted sources.
Return strict JSON only:
{
  "claims": [
    {
      "claim": "exact claim text",
      "supported": true,
      "confidence": 0.91,
      "evidence": ["source title"],
      "risk": "low",
      "notes": "optional short explanation"
    }
  ]
}

Rules:
- supported=true only when the retrieved sources directly support the claim or a conservative clinical recommendation.
- If a claim uses general medical knowledge but is not supported by retrieved sources, mark supported=false unless it is clearly a conservative safety recommendation.
- Mark contradictions and unsafe certainty in notes.
- confidence must be 0..1.
- risk is low, medium, or high.

Retrieved sources:
${sourceBlock(sources)}

Claims:
${JSON.stringify(claims, null, 2)}`;

  try {
    const completion = await chat.client.chat.completions.create({
      model: chat.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a claim-level evidence verifier for regulated AI output." },
        { role: "user", content: prompt }
      ]
    });
    const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}") as { claims?: ClaimVerification[] };
    if (!Array.isArray(parsed.claims)) return fallback;
    return parsed.claims.map((item, index) => ({
      claim: typeof item.claim === "string" ? item.claim : claims[index] ?? "Unparsed claim",
      supported: Boolean(item.supported),
      confidence: clamp(Number(item.confidence ?? 0)),
      evidence: Array.isArray(item.evidence) ? item.evidence.filter((source): source is string => typeof source === "string") : [],
      risk: item.risk === "high" || item.risk === "medium" || item.risk === "low" ? item.risk : "medium",
      notes: typeof item.notes === "string" ? item.notes : undefined
    }));
  } catch {
    return fallback;
  }
}

function summarizeVerification(claims: ClaimVerification[], response: string): VerificationResult {
  const unsupported = claims.filter((claim) => !claim.supported);
  const contradictions = unsupported.filter((claim) => claim.notes?.toLowerCase().includes("contradict")).map((claim) => claim.claim);
  const missing: string[] = [];

  if (response.toLowerCase().includes("warfarin") && !response.toLowerCase().includes("bleeding")) {
    missing.push("Bleeding risk not mentioned");
  }

  const claimScore = claims.length
    ? claims.reduce((sum, claim) => sum + (claim.supported ? claim.confidence : Math.min(claim.confidence, 0.35)), 0) / claims.length
    : 0.5;
  const penalty = unsupported.filter((claim) => claim.risk === "high").length * 0.12 + contradictions.length * 0.18 + missing.length * 0.08;

  return {
    grounding_score: clamp(claimScore - penalty),
    unsupported_claims: unsupported.map((claim) => claim.claim),
    missing_caveats: missing,
    contradictions,
    claims
  };
}

async function verifyGrounding(response: string, sources: RetrievedDocument[]) {
  const claims = await extractClaims(response);
  const claimAssessments = await verifyClaims(claims, sources);
  return summarizeVerification(claimAssessments, response);
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

  const chat = getChatClient();
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

  if (!chat) {
    return `The retrieved sources do not support treating ibuprofen as generally safe with warfarin. Warfarin can cause major bleeding, and FDA and Mayo Clinic materials note that NSAIDs such as ibuprofen can increase bleeding risk when used with blood thinners (Warfarin Medication Guide: Bleeding Risk; Ibuprofen Safety Considerations). Ask a clinician or pharmacist before taking ibuprofen with warfarin, and seek urgent help for unusual bleeding, black stools, severe headache, weakness, or other concerning symptoms.`;
  }

  const completion = await chat.client.chat.completions.create({
    model: chat.model,
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
      provider: generation.provider,
      tokenCounts: generation.tokenCounts,
      rawPreview: generation.rawResponse.slice(0, 180)
    })
  );

  const claims = await extractClaims(generation.rawResponse);
  await push(
    trace("verification", "success", `Extracted ${claims.length} auditable claims`, {
      claims
    })
  );

  const claimAssessments = await verifyClaims(claims, sources);
  await push(
    trace("verification", claimAssessments.some((claim) => !claim.supported) ? "warning" : "success", "Claim-level evidence verification complete", {
      claims: claimAssessments.map((claim) => ({
        claim: claim.claim,
        supported: claim.supported,
        confidence: Number(claim.confidence.toFixed(2)),
        evidence: claim.evidence,
        risk: claim.risk,
        notes: claim.notes
      }))
    })
  );

  const verification = summarizeVerification(claimAssessments, generation.rawResponse);
  await push(
    trace("verification", verification.grounding_score < 0.65 ? "warning" : "success", `Grounding score: ${verification.grounding_score.toFixed(2)}`, {
      unsupportedClaims: verification.unsupported_claims,
      missingCaveats: verification.missing_caveats,
      contradictions: verification.contradictions,
      supportedClaims: verification.claims.filter((claim) => claim.supported).length,
      totalClaims: verification.claims.length
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
          claimAssessments: JSON.stringify(verification.claims),
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
