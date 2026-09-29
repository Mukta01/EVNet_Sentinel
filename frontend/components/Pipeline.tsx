import { ArrowDown, ArrowRight } from "lucide-react";

type Stage = { step: string; title: string; detail: string; figure: string; tone: string };

const fmt = new Intl.NumberFormat("en-US");

/**
 * The method in six steps, with the numbers each step produces. The same
 * diagram is Figure 1 of docs/EVNet_Sentinel_Findings.tex.
 */
export default function Pipeline({
  dataset,
  seeds,
  harness,
}: {
  dataset: { rows_after_dedup: number; n_features: number; n_classes: number; train_rows: number; test_rows: number };
  seeds: number[];
  harness: { trials: number; batch: number };
}) {
  const stages: Stage[] = [
    { step: "01", title: "Capture", tone: "#94A3B8",
      detail: "CICEVSE2024 network traffic from two charging stations, idle and charging.",
      figure: `${dataset.n_classes} classes` },
    { step: "02", title: "Remove leakage", tone: "#F43F5E",
      detail: "Drop the six absolute capture timestamps and src_port; de-duplicate flows.",
      figure: `${fmt.format(dataset.rows_after_dedup)} flows · ${dataset.n_features} features` },
    { step: "03", title: "Split", tone: "#38BDF8",
      detail: "Stratified train / validation / test, repeated with a new split and model seed each run.",
      figure: `seeds ${seeds.join(" / ")}` },
    { step: "04", title: "Detect", tone: "#22C55E",
      detail: "Static: Random Forest, Decision Tree, Logistic Regression, SVM. Online: Adaptive Random Forest with ADWIN.",
      figure: `${fmt.format(dataset.test_rows)} held-out flows per seed` },
    { step: "05", title: "Test per attack", tone: "#F59E0B",
      detail: "Every attack type fed to every model in random batches; graded detected / right category / named.",
      figure: `${harness.trials} trials × ${harness.batch} flows × ${seeds.length} seeds` },
    { step: "06", title: "Respond", tone: "#A78BFA",
      detail: "Map each detection to actions for the station owner, CSMS operator and network analyst.",
      figure: "3 roles · 14 attack types" },
  ];

  return (
    <section aria-labelledby="pipeline-heading" className="mx-auto max-w-6xl px-6 pt-14">
      <h2 id="pipeline-heading" className="text-xl font-semibold tracking-tight text-white">Method at a glance</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        From raw captures to an operator&rsquo;s next step. Numbers are read from the exported results, so
        they match the dashboard.
      </p>
      <ol className="mt-8 grid gap-2 lg:grid-cols-[repeat(6,minmax(0,1fr))] lg:gap-0">
        {stages.map((s, i) => (
          <li key={s.step} className="flex flex-col lg:flex-row lg:items-stretch">
            <div className="flex-1 rounded-lg border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] tabular-nums" style={{ color: s.tone }}>{s.step}</span>
                <h3 className="text-sm font-medium text-slate-100">{s.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.detail}</p>
              <p className="mt-3 border-t border-white/8 pt-2 font-mono text-[11px] tabular-nums text-slate-300">
                {s.figure}
              </p>
            </div>
            {i < stages.length - 1 && (
              <>
                <ArrowDown className="mx-auto my-1 h-4 w-4 text-slate-600 lg:hidden" aria-hidden />
                <ArrowRight className="mx-1 hidden h-4 w-4 shrink-0 self-center text-slate-600 lg:block" aria-hidden />
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
