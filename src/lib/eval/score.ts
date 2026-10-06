import type { Issue } from "@/lib/analysis/checks";

export interface ExpectedIssue {
  id: string;
  description: string;
  keywords: string[];
  minKeywords: number;
  /** 1-based chapters the evidence must cite. */
  chapters?: number[];
}

export interface EvalSpec {
  title: string;
  genre?: string;
  expected: ExpectedIssue[];
  optional?: ExpectedIssue[];
  decoys?: ExpectedIssue[];
}

export interface ScoreResult {
  found: string[];
  missed: string[];
  optionalFound: string[];
  /** Issues that flagged a decoy: definite false positives. */
  decoyHits: { decoy: string; issue: string }[];
  /** Issues matching nothing in the spec: review by hand (may be real problems the spec missed). */
  unmatched: string[];
  recall: number;
  /** Precision counting decoy hits as false and unmatched issues as false (pessimistic). */
  precisionLow: number;
  /** Precision ignoring unmatched issues (optimistic). */
  precisionHigh: number;
}

function haystack(issue: Issue): string {
  return [issue.title, issue.explanation, ...issue.evidence.flatMap((e) => [e.quote, e.note ?? ""])].join(" \n ").toLowerCase();
}

export function matches(issue: Issue, spec: ExpectedIssue): boolean {
  const text = haystack(issue);
  const hits = spec.keywords.filter((k) => text.includes(k.toLowerCase())).length;
  if (hits < spec.minKeywords) return false;
  const cited = new Set(issue.evidence.map((e) => e.chapter_idx + 1));
  return (spec.chapters ?? []).every((c) => cited.has(c));
}

export function scoreIssues(issues: Issue[], spec: EvalSpec): ScoreResult {
  const found = new Set<string>();
  const optionalFound = new Set<string>();
  const decoyHits: ScoreResult["decoyHits"] = [];
  const unmatched: string[] = [];
  let truePositives = 0;

  for (const issue of issues) {
    const exp = spec.expected.find((e) => matches(issue, e));
    if (exp) {
      found.add(exp.id);
      truePositives++;
      continue;
    }
    const opt = spec.optional?.find((e) => matches(issue, e));
    if (opt) {
      optionalFound.add(opt.id);
      truePositives++;
      continue;
    }
    const decoy = spec.decoys?.find((e) => matches(issue, e));
    if (decoy) decoyHits.push({ decoy: decoy.id, issue: issue.title });
    else unmatched.push(issue.title);
  }

  const judged = truePositives + decoyHits.length;
  return {
    found: [...found],
    missed: spec.expected.filter((e) => !found.has(e.id)).map((e) => e.id),
    optionalFound: [...optionalFound],
    decoyHits,
    unmatched,
    recall: spec.expected.length ? found.size / spec.expected.length : 1,
    precisionLow: issues.length ? truePositives / issues.length : 1,
    precisionHigh: judged ? truePositives / judged : 1,
  };
}
