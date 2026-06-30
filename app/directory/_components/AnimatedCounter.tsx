"use client";

import { useEffect, useState, useRef } from "react";

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  label: string;
  delay?: number;
}

export default function AnimatedCounter({
  target,
  suffix = "",
  label,
  delay = 0,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    const timeout = setTimeout(() => {
      const duration = 1800;
      const steps = 60;
      const increment = target / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= target) {
          setCount(target);
          clearInterval(interval);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [hasStarted, target, delay]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-display text-[2.5rem] sm:text-[3rem] text-white leading-none tracking-tight">
        {count.toLocaleString()}
        <span className="text-[#ffb400]">{suffix}</span>
      </div>
      <p className="text-[13px] font-semibold text-[#8b96a1] mt-2 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
