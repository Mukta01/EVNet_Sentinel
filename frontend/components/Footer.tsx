"use client";

import { ShieldCheck, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-[#020617] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span className="font-bold text-lg text-white">
                EVNet <span className="text-emerald-400">Sentinel</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
              ML-powered intrusion detection for EV charging infrastructure.
              Academic research project.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6">
            <a
              href="https://github.com/Mukta01/EVNet_Sentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-500 hover:text-white transition-colors text-sm cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <Link href="/dashboard" className="text-gray-500 hover:text-white transition-colors text-sm">
              Dashboard
            </Link>
            <Link href="/docs" className="text-gray-500 hover:text-white transition-colors text-sm">
              Docs
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-xs text-gray-700 font-mono">
            &copy; {new Date().getFullYear()} EVNet Sentinel &middot; Apache 2.0 License &middot; Built with Next.js + FastAPI
          </p>
        </div>
      </div>
    </footer>
  );
}
