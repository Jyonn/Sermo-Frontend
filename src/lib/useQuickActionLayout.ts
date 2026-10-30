import { useLayoutEffect, useRef } from "react";

// Only measure when the action set changes; the browser animates each move.
export function useQuickActionLayout(signature: string, open: boolean) {
  const root = useRef<HTMLElement | null>(null);
  const positions = useRef(new Map<string, number>());
  const movements = useRef(new Map<string, Animation>());
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const next = new Map<string, number>();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const child of node.querySelectorAll<HTMLElement>(":scope > [data-action]")) {
      const key = child.dataset.action!;
      const transform = getComputedStyle(child).transform;
      const translation = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
      const target = child.getBoundingClientRect().left - translation;
      const previous = positions.current.get(key);
      movements.current.get(key)?.cancel();
      if (open && !reduced && previous !== undefined && Math.abs(previous - target + translation) > 1) {
        movements.current.set(key, child.animate([{ transform: `translateX(${previous - target + translation}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" }));
      }
      next.set(key, target);
    }
    for (const [key, animation] of movements.current) if (!next.has(key) || !open) { animation.cancel(); movements.current.delete(key); }
    positions.current = next;
  }, [signature, open]);
  useLayoutEffect(() => () => { for (const animation of movements.current.values()) animation.cancel(); }, []);
  return root;
}
