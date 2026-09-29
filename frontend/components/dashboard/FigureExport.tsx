"use client";

import type { RefObject } from "react";
import { Download } from "lucide-react";

const BACKGROUND = "#020617";

/**
 * Download a chart exactly as drawn. The charts that use this are plain SVG
 * with inline fills, so the serialised markup is self-contained.
 */
function serialise(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const { width, height } = svg.viewBox.baseVal;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", BACKGROUND);
  clone.insertBefore(bg, clone.firstChild);
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function save(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export default function FigureExport({
  target,
  name,
}: {
  target: RefObject<SVGSVGElement | null>;
  name: string;
}) {
  const asSvg = () => {
    if (!target.current) return;
    const { markup } = serialise(target.current);
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    save(url, `${name}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const asPng = () => {
    if (!target.current) return;
    const { markup, width, height } = serialise(target.current);
    const scale = 3; // print resolution
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      save(canvas.toDataURL("image/png"), `${name}.png`);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  };

  const button =
    "rounded px-2 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

  return (
    <div className="flex items-center gap-1" aria-label="Download figure">
      <Download className="h-3.5 w-3.5 text-slate-600" aria-hidden />
      <button type="button" onClick={asSvg} className={button}>SVG</button>
      <button type="button" onClick={asPng} className={button}>PNG</button>
    </div>
  );
}
