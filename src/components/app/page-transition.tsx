"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.classList.remove("page-enter");
    void node.offsetWidth;
    node.classList.add("page-enter");
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}
