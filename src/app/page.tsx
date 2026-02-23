"use client";

import React from "react";
import { MagnifyingGlass, ArrowRight, Command } from "@phosphor-icons/react/dist/ssr";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default function GlobalDashboard() {
  return (
    <div className={`${jakarta.className} relative min-h-screen bg-[#050505] flex flex-col items-center justify-center overflow-hidden antialiased`}>

      {/* --- BACKGROUND GRAPHICS --- */}

      {/* 1. The Core Glow (Astronaut Blue) */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#5193e0] opacity-[0.15] blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#2f539e] opacity-[0.1] blur-[150px] rounded-full pointer-events-none" />

      {/* 2. The Architectural Grid */}
      {/* This creates a perspective grid that fades out at the edges using a radial mask */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 30%, #000 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 30%, #000 20%, transparent 100%)',
        }}
      />

      {/* 3. Abstract Floating Data Lines (SVG Graphic) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
        <path d="M-100 400 C 300 400, 400 200, 800 250 S 1200 100, 1600 150" fill="none" stroke="url(#gradient1)" strokeWidth="1" />
        <path d="M-100 450 C 200 450, 500 300, 900 350 S 1300 200, 1600 250" fill="none" stroke="url(#gradient2)" strokeWidth="1" />
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5193e0" stopOpacity="0" />
            <stop offset="50%" stopColor="#5193e0" stopOpacity="1" />
            <stop offset="100%" stopColor="#2f539e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#274172" stopOpacity="0" />
            <stop offset="50%" stopColor="#72b1e8" stopOpacity="1" />
            <stop offset="100%" stopColor="#1e2d4d" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* --- FOREGROUND CONTENT --- */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-6">

        {/* Custom SVG Logo */}
        <div className="mb-8 flex flex-col items-center">
          <CapitalBaseLogo className="w-16 h-16 mb-6 drop-shadow-2xl" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-3 text-center drop-shadow-sm">
            CapitalBase
          </h1>
          <p className="text-[#a0a0a0] font-medium text-lg text-center max-w-lg">
            Institutional-grade financial terminal and entity intelligence.
          </p>
        </div>

        {/* Global Search Bar (Glassmorphism) */}
        <div className="w-full relative group mt-4">
          {/* Glowing border effect on hover/focus */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5193e0] to-[#2f539e] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>

          <div className="relative flex items-center bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all focus-within:border-[#5193e0]/50 focus-within:bg-[#0a0a0a]">
            <div className="pl-6 pr-2 py-5 flex items-center pointer-events-none">
              <MagnifyingGlass weight="bold" className="h-6 w-6 text-[#72b1e8]" />
            </div>

            <input
              type="text"
              placeholder="Search by entity name, director, or SIC code..."
              className="block w-full py-5 pr-4 bg-transparent border-none text-white placeholder-[#666666] focus:outline-none focus:ring-0 text-lg font-medium"
            />

            <div className="pr-4 flex items-center space-x-2">
              <div className="hidden md:flex items-center text-[#666666] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-xs font-semibold">
                <Command weight="bold" className="w-3.5 h-3.5 mr-1" /> K
              </div>
              <button className="bg-[#5193e0] hover:bg-[#3d79d3] text-white p-3 rounded-xl transition-colors shadow-lg shadow-[#5193e0]/25">
                <ArrowRight weight="bold" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links / Trending */}
        <div className="mt-10 flex items-center space-x-4 text-sm font-medium">
          <span className="text-[#666666]">Trending:</span>
          <button className="text-[#a0a0a0] hover:text-white transition-colors border border-white/5 bg-white/5 px-3 py-1 rounded-full">Starling Bank</button>
          <button className="text-[#a0a0a0] hover:text-white transition-colors border border-white/5 bg-white/5 px-3 py-1 rounded-full">Monzo</button>
          <button className="text-[#a0a0a0] hover:text-white transition-colors border border-white/5 bg-white/5 px-3 py-1 rounded-full">Revolut</button>
        </div>

      </div>
    </div>
  );
}

// --- CUSTOM SVG LOGO COMPONENT ---
// Concept: "The Ascending Data Pillars"
// Perfectly mathematically centered (X bounds: 16-48, Y bounds: 18-46).
function CapitalBaseLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background Rounded Square */}
      <rect width="64" height="64" rx="16" fill="url(#logo-gradient)" />

      {/* The Ascending Trend Pillars */}
      {/* Left Pillar (Opacity 60%) */}
      <rect x="16" y="34" width="8" height="12" rx="4" fill="#ffffff" opacity="0.6" />

      {/* Middle Pillar (Opacity 85%) */}
      <rect x="28" y="26" width="8" height="20" rx="4" fill="#ffffff" opacity="0.85" />

      {/* Right Pillar (Full Astronaut Blue Pop) */}
      <rect x="40" y="18" width="8" height="28" rx="4" fill="#72b1e8" />

      {/* Premium subtle inner shadow/glow definition */}
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5193e0" />
          <stop offset="1" stopColor="#1e2d4d" />
        </linearGradient>
      </defs>
    </svg>
  );
}