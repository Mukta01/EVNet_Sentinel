"use client";

import { useRef, useEffect, useState, useCallback, KeyboardEvent } from 'react';
import { gsap } from 'gsap';

export interface Threat {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  border: string;
  bg: string;
  glow: string;
  iconBg: string;
  image: string;
}

export default function ThreatAccordion({ threats }: { threats: Threat[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const firstRunRef = useRef(true);

  const count = threats.length;
  const [active, setActive] = useState(0);

  const duration = 0.5;
  const ease = 'power3.out';
  const tilt = 3; 

  const applyLayout = useCallback(
    (animate: boolean) => {
      const panels = panelRefs.current;
      if (!panels.length) return;

      const grow = 3.5;

      tlRef.current?.kill();
      const dur = animate ? duration : 0;
      const tl = gsap.timeline();

      panels.forEach((panel, i) => {
        if (!panel) return;
        const isActive = i === active;
        const rot = isActive ? 0 : i < active ? tilt : -tilt;

        tl.to(
          panel,
          {
            flexGrow: isActive ? grow : 1,
            rotateY: rot,
            duration: dur,
            ease,
          },
          0
        );

        const content = contentRefs.current[i];
        if (content) {
          tl.to(
            content,
            {
              opacity: isActive ? 1 : 0,
              x: isActive ? 0 : 10,
              filter: isActive ? 'blur(0px)' : 'blur(4px)',
              duration: dur * 0.8,
              ease,
            },
            0
          );
        }
        
        const title = titleRefs.current[i];
        if (title) {
          tl.to(
            title,
            {
              opacity: isActive ? 1 : 0.3,
              x: isActive ? 0 : 10,
              duration: dur * 0.8,
              ease,
            },
            0
          );
        }
      });

      tlRef.current = tl;
    },
    [active]
  );

  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout]);

  const handleEnter = (i: number) => {
    setActive(i);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i + 1) % count);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i - 1 + count) % count);
    }
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-col lg:flex-row gap-3 w-full h-[800px] lg:h-[360px] perspective-[1200px]"
      role="list"
    >
      {threats.map((threat, i) => {
        const isActive = i === active;
        return (
          <div
            key={i}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className={`group relative flex-1 ${threat.bg} border ${threat.border} ${threat.glow} rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer outline-none flex flex-col justify-start`}
            onMouseEnter={() => handleEnter(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            role="listitem"
            tabIndex={0}
          >
            {/* Background Image with Hover Effect */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-700 ${isActive ? 'opacity-50' : 'opacity-20 mix-blend-overlay'} group-hover:opacity-60`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={threat.image} 
                alt={threat.title} 
                className={`w-full h-full object-cover transition-transform duration-700 ${isActive ? 'scale-110' : 'scale-100'}`} 
              />
            </div>
            
            {/* Gradient Overlay for Text Readability */}
            <div className={`absolute inset-0 z-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent transition-opacity duration-500 ${isActive ? 'opacity-80' : 'opacity-100'}`} />

            {/* Content Container */}
            <div className="relative z-10 p-5 md:p-6 flex flex-col h-full w-full">
              {/* Header Icon */}
              <div className="flex items-center gap-4 shrink-0 mb-6">
                <div
                  className={`w-12 h-12 rounded-xl ${threat.iconBg} border ${threat.border.split(' ')[0]} flex items-center justify-center ${threat.color} shrink-0 shadow-lg`}
                >
                  {threat.icon}
                </div>
              </div>

              {/* Title Container - Fixed width to prevent wrapping issues when shrinking */}
              <div className="relative h-14 shrink-0">
                  <h3 
                    ref={(el) => {
                      titleRefs.current[i] = el;
                    }}
                    className="absolute top-0 left-0 text-xl font-bold text-white tracking-tight w-[280px] leading-tight"
                  >
                    {threat.title}
                  </h3>
              </div>

              {/* Description Container */}
              <div className="relative flex-1 mt-2">
                <div
                  ref={(el) => {
                    contentRefs.current[i] = el;
                  }}
                  className="absolute top-0 left-0 w-[260px] md:w-[280px] text-sm text-gray-300 leading-relaxed drop-shadow-md"
                >
                  {threat.description}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
