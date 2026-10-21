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

/**
 * Round to `digits`, except never up to 1: a value below 1 that would print
 * as 1 is floored instead (0.99996 -> 0.9999), because "1.000" reads as a
 * claim the data does not support.
 */
const nearOne = (v: number, digits: number) => {
  const k = 10 ** digits;
  const r = Math.round(v * k) / k;
  return v < 1 && r >= 1 ? Math.floor(v * k) / k : r;
};
/** Values in [0.995, 1) get one more digit, so 0.99988 reads 0.9999, not 1.000. */
export const fmtScore = (v: number) =>
  v >= 0.995 && v < 1 ? nearOne(v, 4).toFixed(4) : nearOne(v, 3).toFixed(3);
/** Digits fmtScore shows for this value, so a spread can be printed to match. */
const scoreDigits = (v: number) => (v >= 0.995 && v < 1 ? 4 : 3);
/**
 * A spread is rounded UP at the score's precision, never down: a seed-to-seed
 * std of 0.00002 prints as "0.0001", not "0.0000", which would claim no spread
 * at all. Rounding an uncertainty up is the conservative convention.
 */
export const fmtStd = (std: number, score: number, digits?: number) => {
  const d = digits ?? scoreDigits(score);
  return std <= 0 ? (0).toFixed(d) : (Math.ceil(std * 10 ** d - 1e-9) / 10 ** d).toFixed(d);
};
export const fmtScoreStd = (v: number, std: number, digits?: number) =>
  digits ? `${nearOne(v, digits).toFixed(digits)} ± ${fmtStd(std, v, digits)}` : `${fmtScore(v)} ± ${fmtStd(std, v)}`;
/**
 * A model's confidence is an estimate, not a certainty, even when every tree
 * votes the same way (exactly 1.0): at the top it reads "≥ 99.99%".
 */
export const fmtConfidence = (v: number) => (v >= 0.9999 ? "≥ 99.99%" : fmtPct(v));
/** Wilson score 95% lower bound for k successes out of n. Monotonic in k. */
const wilsonLower = (k: number, n: number, z = 1.96) => {
  const p = k / n, z2 = z * z;
  return (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n);
};
/**
 * A test pass rate. Near the top a point estimate misleads: 4,500 of 4,500
 * would read "100%" ("never fails"), and bounding only the perfect cells would
 * rank them below a cell with one miss. So every rate of 99% or more shows its
 * Wilson 95% lower bound, always at two decimals: 4,500/4,500 reads
 * "≥ 99.91%", 4,499/4,500 a little lower. Classes tested on fewer than 100
 * distinct flows show the count instead, because a bound that wide says little.
 */
export const fmtRate = (v: number, n?: number) => {
  if (!n || v < 0.99) return fmtPct(v);
  const k = Math.round(v * n);
  if (n < 100) return `${k}/${n}`;
  return `≥ ${(Math.floor(wilsonLower(k, n) * 1e4) / 100).toFixed(2)}%`;
};
export const rateNote = (v: number, n?: number) =>
  n && v >= 0.99
    ? `${Math.round(v * n).toLocaleString()} of ${n.toLocaleString()} tested flows passed${n >= 100 ? "; Wilson 95% lower bound" : ""}`
    : undefined;
/** Percentages follow the same rule: 99.996% prints as 99.99%, never 100%. */
export const fmtPct = (v: number) =>
  v >= 0.999 && v < 1 ? `${(nearOne(v, 4) * 100).toFixed(2)}%`
  : v >= 0.995 && v < 1 ? `${(nearOne(v, 3) * 100).toFixed(1)}%` : `${Math.round(nearOne(v, 2) * 100)}%`;

export const MODEL_COLOR: Record<string, string> = {
  RandomForest: "#22C55E",
  DecisionTree: "#38BDF8",
  XGBoost: "#F59E0B",
  LightGBM: "#2DD4BF",
  LogisticRegression: "#A78BFA",
  SVM: "#F472B6",
};

export const MODEL_LABEL: Record<string, string> = {
  RandomForest: "Random Forest",
  DecisionTree: "Decision Tree",
  XGBoost: "XGBoost",
  LightGBM: "LightGBM",
  LogisticRegression: "Logistic Regression",
  SVM: "SVM",
};

/** Class names carry underscores in the dataset; render them readably. */
export const prettyClass = (name: string) => name.replace(/_/g, " ");

export const SURFACE = "border border-white/8 bg-white/[0.02]";
