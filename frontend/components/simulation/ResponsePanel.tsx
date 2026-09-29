"use client";

import { MODEL_LABEL, prettyClass } from "../dashboard/theme";

export type ResponseEntry = {
  label: string;
  category: "dos" | "recon" | "benign";
  severity: string;
  what: string;
  impact: string;
  categorySummary: string;
  actions: Record<string, string[]>;
  categoryActions: Record<string, string[]>;
  /** Harness verdict per model for this attack: identified / category / detected / missed. */
  reliability: Record<string, string>;
};
export type ResponseMap = Record<string, ResponseEntry>;

const CATEGORY = {
  dos: "Denial of service",
  recon: "Reconnaissance",
  benign: "Normal traffic",
} as const;

const SEVERITY: Record<string, { fg: string; bg: string; label: string }> = {
  critical: { label: "Critical", fg: "#FECDD3", bg: "rgba(225,29,72,0.28)" },
  high: { label: "High", fg: "#FED7AA", bg: "rgba(234,88,12,0.24)" },
  medium: { label: "Medium", fg: "#FDE68A", bg: "rgba(217,119,6,0.20)" },
  none: { label: "None", fg: "#CBD5E1", bg: "rgba(100,116,139,0.20)" },
};

/**
 * What the operator should do about the flow at the tap.
 *
 * Keyed by what the detector PREDICTED, not by ground truth -- in a real
 * deployment the prediction is all an operator has. When the active model is
 * not reliable at naming the predicted attack (per the attack test harness),
 * the panel steps back to the category and says so, because acting on a
 * confidently wrong name is worse than acting on a correct category.
 */
export default function ResponsePanel({
  truth, predicted, model, responses, roles, categorySeverity,
}: {
  truth: string | null;
  predicted: string | null;
  model: string;
  responses: ResponseMap;
  roles: Record<string, string>;
  categorySeverity: Record<string, string[]>;
}) {
  if (!predicted) return null;

  const modelName = MODEL_LABEL[model] ?? model.replace(/_/g, " ");

  if (predicted === "Benign") {
    const missed = truth && truth !== "Benign";
    return (
      <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Recommended response</h3>
        <p className="mt-2 text-sm text-slate-300">No alert raised — {modelName} judged this flow normal.</p>
        {missed && (
          <p className="mt-2 text-xs leading-relaxed text-rose-300/85">
            The flow was actually {prettyClass(truth!)}. This is a missed attack: nothing would have
            prompted an operator to act.
          </p>
        )}
      </div>
    );
  }

  const entry = responses[predicted];
  if (!entry) return null;

  // Trust the exact name only where the harness says this model names it
  // reliably. Models with no test record (the online ARF) fall back to the
  // category for reconnaissance, which no tested model names reliably.
  const verdict = entry.reliability[model];
  const trustName = verdict ? verdict === "identified" : entry.category !== "recon";
  const categoryEntry = entry.category;

  const title = trustName
    ? `${entry.label} detected`
    : `${CATEGORY[categoryEntry]} detected — exact type uncertain`;
  const RANK = ["none", "medium", "high", "critical"];
  const range = [...new Set(categorySeverity[categoryEntry] ?? [entry.severity])]
    .filter((v) => v !== "none")
    .sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b));
  // Colour the badge by the worst case in the range: under-reacting to an
  // unnamed scan is the costlier mistake.
  const sev = trustName
    ? SEVERITY[entry.severity] ?? SEVERITY.medium
    : SEVERITY[range[range.length - 1]] ?? SEVERITY.medium;
  const sevLabel = trustName || range.length < 2
    ? sev.label
    : `${SEVERITY[range[0]].label}–${SEVERITY[range[range.length - 1]].label}`;
  const shown = trustName ? entry.actions : entry.categoryActions;
  const roleKeys = Object.keys(roles).filter((r) => (shown[r] ?? []).length > 0);

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Recommended response</h3>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: sev.fg, background: sev.bg }}>
          {sevLabel}
        </span>
      </div>

      <p className="mt-2 text-[15px] font-medium text-slate-100">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
        {trustName ? entry.what : entry.categorySummary}
      </p>
      {!trustName && (
        <p className="mt-2 text-xs leading-relaxed text-sky-200/80">
          {modelName} called this {entry.label}, but it cannot reliably tell{" "}
          {categoryEntry === "recon" ? "scan types" : "these attacks"} apart — so the guidance below is
          for the category, which it does get right.
        </p>
      )}

      {/* Stacked, not columned: the console's centre column is too narrow for three. */}
      <dl className="mt-4 space-y-3">
        {roleKeys.map((role) => (
          <div key={role} className="grid gap-1 border-t border-white/10 pt-2.5 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-slate-200">{roles[role]}</dt>
            <dd>
              <ul className="space-y-1.5">
                {shown[role].map((step) => (
                  <li key={step} className="text-[12.5px] leading-relaxed text-slate-400 [overflow-wrap:anywhere]">{step}</li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
