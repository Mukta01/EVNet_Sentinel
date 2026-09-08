"use client";

import { MODEL_COLOR, MODEL_LABEL } from "./theme";

type ModelRow = {
  name: string;
  macro_f1: number;
  macro_f1_std: number;
  weighted_f1: number;
  weighted_f1_std: number;
  accuracy: number;
  accuracy_std: number;
  fit_seconds: number;
  fit_seconds_std: number;
};

/**
 * Every model on one axis, with the spread visible.
 *
 * Macro-F1 leads because the class distribution is extreme: accuracy tracks the
 * flood classes and would rank these four almost identically.
 */
export default function ModelTable({
  models,
  seeds,
}: {
  models: ModelRow[];
  seeds: number[];
}) {
  const max = Math.max(...models.map((m) => m.macro_f1 + m.macro_f1_std));

  return (
    <section aria-labelledby="models-heading">
      <h3 id="models-heading" className="text-lg font-semibold tracking-tight text-white">
        Model comparison
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
        Mean and standard deviation over seeds {seeds.join(", ")}. Each seed
        re-runs the split as well as model initialisation, so the spread reflects
        split variance rather than tie-breaking alone.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th scope="col" className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Model
              </th>
              <th scope="col" className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Macro F1
              </th>
              <th scope="col" className="pb-3 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Weighted F1
              </th>
              <th scope="col" className="pb-3 pr-4 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Accuracy
              </th>
              <th scope="col" className="pb-3 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Fit time
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.name} className="border-b border-white/5">
                <th scope="row" className="py-3.5 pr-4 text-left font-normal">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: MODEL_COLOR[model.name] }}
                    />
                    {MODEL_LABEL[model.name] ?? model.name}
                  </span>
                </th>
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-1.5 w-32 rounded-full bg-white/[0.04]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${(model.macro_f1 / max) * 100}%`,
                          background: MODEL_COLOR[model.name],
                        }}
                      />
                      <div
                        aria-hidden
                        className="absolute inset-y-0 flex items-center"
                        style={{
                          left: `${((model.macro_f1 - model.macro_f1_std) / max) * 100}%`,
                          width: `${((model.macro_f1_std * 2) / max) * 100}%`,
                        }}
                      >
                        <span className="h-px w-full bg-white/50" />
                      </div>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-100">
                      {model.macro_f1.toFixed(4)}
                      <span className="text-slate-500"> ± {model.macro_f1_std.toFixed(4)}</span>
                    </span>
                  </div>
                </td>
                <td className="py-3.5 pr-4 text-right font-mono text-xs tabular-nums text-slate-400">
                  {model.weighted_f1.toFixed(4)}
                </td>
                <td className="py-3.5 pr-4 text-right font-mono text-xs tabular-nums text-slate-400">
                  {model.accuracy.toFixed(4)}
                </td>
                <td className="py-3.5 text-right font-mono text-xs tabular-nums text-slate-400">
                  {model.fit_seconds.toFixed(1)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 max-w-prose text-sm leading-relaxed text-slate-400">
        Random Forest and Decision Tree overlap at one standard deviation. Their
        earlier apparent gap came from <code className="font-mono text-slate-300">src_port</code>,
        an ephemeral port that bands per capture; with it removed they are
        indistinguishable.
      </p>
    </section>
  );
}
