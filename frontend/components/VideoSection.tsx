"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Clapperboard } from "lucide-react";
import DecryptedText from "./DecryptedText";

/**
 * The project video under the hero (YouTube JkRQUmMl6m8, rendered from video/).
 * It shows our own poster (public/video-poster.jpg) and only loads the player
 * (from youtube-nocookie.com) when someone presses play, so the page stays
 * light and sets no YouTube cookies until then. YouTube's auto-captions are off
 * (cc_load_policy=0): the captions are burned into the video. With VIDEO_ID empty it falls
 * back to a "coming soon" card.
 */
const VIDEO_ID = "JkRQUmMl6m8";
const VIDEO_TITLE = "The 98% was a data leak: EVNet Sentinel";
const VIDEO_LENGTH = "2:39";

export default function VideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section id="video" className="relative px-6 pb-8 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="theme-dark-island mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050b18]"
      >
        <div className="relative aspect-video">
          {VIDEO_ID && playing ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&cc_load_policy=0`}
              title={VIDEO_TITLE}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : VIDEO_ID ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              aria-label={`Play video: ${VIDEO_TITLE}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/video-poster.jpg" alt="" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
              <span className="absolute left-[76%] top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.45)] transition-transform group-hover:scale-105">
                <Play className="ml-1 h-8 w-8" aria-hidden />
              </span>
            </button>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <Clapperboard className="h-6 w-6 text-emerald-400" aria-hidden />
              </span>
              <p className="text-lg font-semibold text-white">
                <DecryptedText text="Project video coming soon" animateOn="view" sequential revealDirection="start" speed={40} encryptedClassName="text-emerald-400/70" />
              </p>
              <p className="max-w-sm text-[13px] text-slate-400">
                A two-minute walkthrough: the leak we found, the corrected results, and Sentinel catching a live attack.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-[12.5px] text-slate-400">
          <DecryptedText text={VIDEO_TITLE} animateOn="view" sequential speed={35} className="text-slate-200" encryptedClassName="text-emerald-400/70" />
          <span className="font-mono">{VIDEO_LENGTH}</span>
        </div>
      </motion.div>
    </section>
  );
}
