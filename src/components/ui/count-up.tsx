"use client";

import { useEffect, useRef } from "react";

const NUMBER_PATTERN = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s;

export function CountUp({ value, duration = 900 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const match = value.match(NUMBER_PATTERN);
    if (!match || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.textContent = value;
      return;
    }
    const [, prefix, rawNumber, suffix] = match;
    const decimals = rawNumber.includes(".") ? rawNumber.split(".")[1].length : 0;
    const grouped = rawNumber.includes(",");
    const target = Number(rawNumber.replace(/,/g, ""));
    if (!Number.isFinite(target)) {
      node.textContent = value;
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      const formatted = grouped
        ? current.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : current.toFixed(decimals);
      node.textContent = `${prefix}${formatted}${suffix}`;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = value;
    };
  }, [duration, value]);

  return (
    <span ref={ref} className="tabular">
      {value}
    </span>
  );
}
