export type PlanId = "free" | "author" | "pro" | "studio";

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  /** Books the author can keep in Verse. null = unlimited. */
  books: number | null;
  /** Largest single manuscript we will analyze. */
  maxManuscriptWords: number;
  /** Newly analyzed words per month. Unchanged chapters are free to re-analyze. */
  monthlyAnalysisWords: number;
  monthlyQuestions: number;
  /** Full editorial reports per month. */
  monthlyReports: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    tagline: "See what Verse finds in your book.",
    books: 1,
    maxManuscriptWords: 30_000,
    monthlyAnalysisWords: 30_000,
    monthlyQuestions: 15,
    monthlyReports: 1,
    features: ["1 book — first 30,000 words analyzed", "Story Bible: characters, places, timeline", "Consistency check with evidence", "15 Ask Your Book questions / month", "1 editorial report / month"],
  },
  author: {
    id: "author",
    name: "Author",
    monthly: 15,
    yearly: 144,
    tagline: "For one book in progress.",
    books: 3,
    maxManuscriptWords: 150_000,
    monthlyAnalysisWords: 200_000,
    monthlyQuestions: 300,
    monthlyReports: 3,
    features: ["3 books up to 150,000 words", "200,000 newly analyzed words / month", "Re-analyze unchanged chapters free", "300 Ask Your Book questions / month", "3 editorial reports / month", "Full consistency, plot & pacing reports"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: 39,
    yearly: 372,
    tagline: "For working authors and series.",
    books: null,
    maxManuscriptWords: 300_000,
    monthlyAnalysisWords: 750_000,
    monthlyQuestions: 1500,
    monthlyReports: 10,
    features: ["Unlimited books up to 300,000 words", "750,000 newly analyzed words / month", "1,500 Ask Your Book questions / month", "10 editorial reports / month", "Priority analysis queue", "Everything in Author"],
  },
  studio: {
    id: "studio",
    name: "Studio",
    monthly: 99,
    yearly: 948,
    tagline: "For editors, coaches and small presses.",
    books: null,
    maxManuscriptWords: 300_000,
    monthlyAnalysisWords: 2_500_000,
    monthlyQuestions: 5000,
    monthlyReports: 25,
    features: ["2.5M newly analyzed words / month", "5,000 questions / month", "25 editorial reports / month", "Client workspaces (coming soon)", "Everything in Pro"],
  },
};

export const PAID_PLANS: PlanId[] = ["author", "pro", "studio"];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}
