export type Domain = "medical" | "financial" | "legal" | "general";

export type TraceStage =
  | "input"
  | "retrieval"
  | "generation"
  | "extraction"
  | "verification"
  | "policy"
  | "intervention"
  | "output";

export type TraceStatus = "success" | "warning" | "failure";

export type TraceEvent = {
  timestamp: string;
  stage: TraceStage;
  status: TraceStatus;
  message: string;
  metadata?: Record<string, unknown>;
};

export type TrustedDocument = {
  id: string;
  source: string;
  title: string;
  content: string;
};

export type RetrievedDocument = TrustedDocument & {
  similarity: number;
};

export type VerificationResult = {
  grounding_score: number;
  unsupported_claims: string[];
  missing_caveats: string[];
  contradictions: string[];
  claims: ClaimVerification[];
};

export type ClaimVerification = {
  claim: string;
  supported: boolean;
  confidence: number;
  evidence: string[];
  risk: "low" | "medium" | "high";
  notes?: string;
};

export type RiskResult = {
  hallucinationRisk: number;
  severity: "low" | "medium" | "high";
  signals: string[];
};

export type PolicyAction = "ALLOW" | "WARN" | "REWRITE" | "BLOCK";

export type PolicyDecision = {
  action: PolicyAction;
  reason: string;
};

export type GovernanceResult = {
  conversationId: string;
  query: string;
  domain: Domain;
  finalResponse: string;
  rawResponse: string;
  sources: RetrievedDocument[];
  traces: TraceEvent[];
  verification: VerificationResult;
  risk: RiskResult;
  policy: PolicyDecision;
};
