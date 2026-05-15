import { detectDomain } from "@/app/lib/domain";
import { getChatClient } from "@/app/lib/openai";
import { prisma } from "@/app/lib/prisma";
import { clamp } from "@/app/lib/utils";
import type {
  ClaimVerification,
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

async function generateResponse(query: string) {
  const prompt = `You are a medical knowledge assistant. Provide helpful, cautious, evidence-aware responses.
Cite or recommend sources when possible.

At the end of your response, list any sources you used or recommend, in the format: SOURCES: [URL or title]

User question:
${query}`;

  const chat = getChatClient();

  if (!chat) {
    return {
      prompt,
      rawResponse: `This question requires professional medical guidance. I recommend consulting qualified healthcare resources or a clinician for personalized advice.`,
      tokenCounts: { prompt: Math.round(prompt.length / 4), completion: 42 },
      model: "offline-demo-generator",
      provider: "offline"
    };
  }

  const completion = await chat.client.chat.completions.create({
    model: chat.model,
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
    model: completion.model,
    provider: chat.provider
  };
}

function parseSources(response: string): string[] {
  const sourcesMatch = response.match(/SOURCES:\s*(.+)/i);
  if (!sourcesMatch) return [];
  const sourcesText = sourcesMatch[1];
  return sourcesText.split(',').map(s => s.trim()).filter(s => s);
}

async function fetchSources(sourceList: string[]): Promise<RetrievedDocument[]> {
  const fetched: RetrievedDocument[] = [];
  for (const source of sourceList) {
    if (source.startsWith('http')) {
      try {
        const response = await fetch(source);
        const content = await response.text();
        fetched.push({
          id: `fetched-${Date.now()}-${fetched.length}`,
          title: source,
          source: 'Web',
          content: content.slice(0, 2000), // Limit content
          similarity: 1
        });
      } catch (error) {
        console.error(`Failed to fetch ${source}:`, error);
      }
    } else {
      // Title, create dummy
      fetched.push({
        id: `title-${Date.now()}-${fetched.length}`,
        title: source,
        source: 'AI-suggested',
        content: `Content for ${source} (placeholder)`,
        similarity: 1
      });
    }
  }
  return fetched;
}

async function extractClaims(response: string): Promise<ClaimVerification[]> {
  const chat = getChatClient();
  if (!chat) return [];

  const prompt = `Extract all factual claims from the following response. For each claim, determine if it's supported by evidence, and assign a confidence score from 0 to 1.

Return a JSON object with a "claims" key containing an array of objects with keys: claim, supported (boolean), confidence (number).

Response:
${response}`;

  try {
    const completion = await chat.client.chat.completions.create({
      model: chat.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Extract factual claims from the response and return as JSON." },
        { role: "user", content: prompt }
      ]
    });
    const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}");
    const claims = Array.isArray(parsed.claims) ? parsed.claims : Array.isArray(parsed) ? parsed : [];
    return claims.filter((c: any) => c.claim && typeof c.confidence === 'number');
  } catch (error) {
    console.error("Claim extraction failed:", error);
    return [];
  }
}

function fallbackVerification(response: string, sources: RetrievedDocument[]): VerificationResult {
  const evidence = sources.map((source) => `${source.title} ${source.content}`.toLowerCase()).join(" ");
  const unsupported: string[] = [];
  const missing: string[] = [];
  const contradictions: string[] = [];
  const lower = response.toLowerCase();

  if (lower.includes("generally safe") && evidence.includes("increased")) {
    unsupported.push("The response asserts general safety despite trusted sources noting increased risk.");
    contradictions.push("Trusted sources describe increased risk, but the response presents safety as likely.");
  }
  if (lower.includes("warfarin") && !lower.includes("bleeding")) {
    missing.push("Bleeding risk is not mentioned for warfarin-related guidance.");
  }
  if (!response.includes("(")) {
    unsupported.push("Response does not cite retrieved source titles inline.");
  }

  const penalty = unsupported.length * 0.15 + missing.length * 0.12 + contradictions.length * 0.13;
  return {
    grounding_score: clamp(0.86 - penalty),
    unsupported_claims: unsupported,
    missing_caveats: missing,
    contradictions,
    claims: []
  };
}

async function verifyGrounding(claims: ClaimVerification[], sources: RetrievedDocument[]): Promise<VerificationResult> {
  const chat = getChatClient();
  if (!chat) {
    // Fallback: assume claims are verified based on sources
    const evidence = sources.map((source) => `${source.title} ${source.content}`.toLowerCase()).join(" ");
    const verifiedClaims = claims.map((claim) => ({
      ...claim,
      supported: evidence.includes(claim.claim.toLowerCase()),
      confidence: evidence.includes(claim.claim.toLowerCase()) ? 0.8 : 0.2,
      evidence: [],
      risk: "medium" as const,
      notes: "Fallback verification"
    }));
    const grounding_score = verifiedClaims.reduce((sum, c) => sum + c.confidence, 0) / verifiedClaims.length || 0.5;
    return {
      grounding_score,
      unsupported_claims: verifiedClaims.filter(c => !c.supported).map(c => c.claim),
      missing_caveats: [],
      contradictions: [],
      claims: verifiedClaims
    };
  }

  const verifiedClaims: ClaimVerification[] = [];
  for (const claim of claims) {
    const prompt = `Verify this claim against the retrieved sources.

Claim: ${claim.claim}

Retrieved sources:
${sourceBlock(sources)}

Return JSON: {"supported": boolean, "confidence": number, "evidence": [string], "risk": "low"|"medium"|"high", "notes": string}`;

    try {
      const completion = await chat.client.chat.completions.create({
        model: chat.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Verify the claim against sources." },
          { role: "user", content: prompt }
        ]
      });
      const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}");
      verifiedClaims.push({
        claim: claim.claim,
        supported: Boolean(parsed.supported),
        confidence: Number(parsed.confidence) || 0,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        risk: (parsed.risk === "low" || parsed.risk === "medium" || parsed.risk === "high") ? parsed.risk : "medium",
        notes: parsed.notes || ""
      });
    } catch {
      verifiedClaims.push({
        ...claim,
        supported: false,
        confidence: 0,
        evidence: [],
        risk: "high",
        notes: "Verification failed"
      });
    }
  }

  const grounding_score = verifiedClaims.reduce((sum, c) => sum + c.confidence, 0) / verifiedClaims.length || 0;
  return {
    grounding_score,
    unsupported_claims: verifiedClaims.filter(c => !c.supported).map(c => c.claim),
    missing_caveats: [],
    contradictions: [],
    claims: verifiedClaims
  };
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

  const domain = await detectDomain(query);
  await push(trace("input", domain === "general" ? "success" : "warning", `Domain detected: ${domain}`, { domain }));

  const generation = await generateResponse(query);
  await push(
    trace("generation", "success", "Initial model response generated", {
      model: generation.model,
      provider: generation.provider,
      tokenCounts: generation.tokenCounts,
      rawPreview: generation.rawResponse.slice(0, 180)
    })
  );

  const answer = generation.rawResponse.split(/SOURCES:/i)[0].trim();
  const suggestedSources = parseSources(generation.rawResponse);
  const allSources = await fetchSources(suggestedSources);
  await push(trace("retrieval", "success", `Discovered ${allSources.length} sources`, {
    sources: allSources.map(s => ({ title: s.title, source: s.source }))
  }));

  // Update rawResponse to answer only
  generation.rawResponse = answer;

  const claims = await extractClaims(generation.rawResponse);
  await push(trace("extraction", "success", `Extracted ${claims.length} claims`, { claims: claims.map(c => c.claim) }));

  const verification = await verifyGrounding(claims, allSources.length > 0 ? allSources : claims.length > 0 ? [] : []);
  await push(
    trace("verification", verification.grounding_score < 0.65 ? "warning" : "success", `Grounding score: ${verification.grounding_score.toFixed(2)}`, {
      unsupportedClaims: verification.unsupported_claims,
      missingCaveats: verification.missing_caveats,
      contradictions: verification.contradictions,
      claims: verification.claims.map(c => ({ claim: c.claim, supported: c.supported, confidence: c.confidence }))
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

  const finalResponse = await intervene(query, generation.rawResponse, allSources, verification, policy);
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
          { role: "assistant", content: finalResponse, rawContent: answer }
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
    sources: allSources,
    traces,
    verification,
    risk,
    policy
  };
}
