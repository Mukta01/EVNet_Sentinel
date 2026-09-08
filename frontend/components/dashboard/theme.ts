/**
 * Dashboard visual constants, inherited from the landing page's world
 * (app/globals.css tokens). This surface expands that world; it does not
 * introduce a second identity.
 */

/**
 * Attack families, grouped by mechanism rather than by textbook category.
 *
 * Grouping every denial-of-service class together would drag the "solved" mean
 * to 0.786 and invite the objection that reconnaissance simply has less data.
 * Splitting volumetric floods from low-rate and data-starved classes removes
 * that: both headline groups carry comparable support, and only their outcomes
 * differ.
 */
export const FAMILY = {
  volumetric: {
    label: "Volumetric flood",
    short: "Flood",
    stroke: "#22C55E",
    fill: "rgba(34, 197, 94, 0.85)",
    dim: "rgba(34, 197, 94, 0.16)",
    text: "text-emerald-300",
  },
  recon: {
    label: "Reconnaissance",
    short: "Recon",
    stroke: "#F59E0B",
    fill: "rgba(245, 158, 11, 0.85)",
    dim: "rgba(245, 158, 11, 0.16)",
    text: "text-amber-300",
  },
  other: {
    label: "Low-rate or sparse",
    short: "Sparse",
    stroke: "#64748B",
    fill: "rgba(100, 116, 139, 0.75)",
    dim: "rgba(100, 116, 139, 0.16)",
    text: "text-slate-300",
  },
} as const;

export type Family = keyof typeof FAMILY;

export const MODEL_COLOR: Record<string, string> = {
  RandomForest: "#22C55E",
  DecisionTree: "#38BDF8",
  LogisticRegression: "#A78BFA",
  SVM: "#F472B6",
};

export const MODEL_LABEL: Record<string, string> = {
  RandomForest: "Random Forest",
  DecisionTree: "Decision Tree",
  LogisticRegression: "Logistic Regression",
  SVM: "SVM",
};

/** Class names carry underscores in the dataset; render them readably. */
export const prettyClass = (name: string) => name.replace(/_/g, " ");

export const SURFACE = "border border-white/8 bg-white/[0.02]";
