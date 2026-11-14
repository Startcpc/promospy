"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/** Pointer light changes paint only; interactive targets never move. */
export function MotionSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  const light = (event: PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const element = event.currentTarget, box = element.getBoundingClientRect();
    element.style.setProperty('--light-x', `${event.clientX - box.left}px`);
    element.style.setProperty('--light-y', `${event.clientY - box.top}px`);
  };
  return <div className={`motion-surface ${className}`} onPointerMove={light}>{children}</div>;
}

/** Content stays readable in server HTML and when JavaScript is unavailable. */
export function ScrollReveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (element.getBoundingClientRect().top > window.innerHeight) element.dataset.reveal = 'pending';
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { element.dataset.reveal = 'visible'; observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`scroll-reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>;
}
