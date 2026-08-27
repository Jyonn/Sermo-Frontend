import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type VirtualListAlignment = "start" | "center" | "end" | "nearest";

export interface VirtualDynamicListHandle {
  scrollToEnd: (behavior?: ScrollBehavior) => void;
  scrollToIndex: (index: number, alignment?: VirtualListAlignment, behavior?: ScrollBehavior) => boolean;
}

interface VirtualDynamicListProps<T> {
  className?: string;
  estimateSize: (item: T, index: number) => number;
  followEnd?: () => boolean;
  itemKey: (item: T) => string;
  items: T[];
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  rowGap?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
}

interface VirtualLayoutItem {
  key: string;
  index: number;
  size: number;
  start: number;
  end: number;
}

interface PendingAnchor {
  key: string;
  offset: number;
  followEnd: boolean;
}

interface LayoutSnapshot {
  items: VirtualLayoutItem[];
  spacerOffset: number;
  totalSize: number;
}

const DEFAULT_OVERSCAN = 720;

function findFirstEndingAfter(layout: VirtualLayoutItem[], position: number) {
  let low = 0;
  let high = layout.length - 1;
  let result = layout.length;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (layout[middle].end >= position) {
      result = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  return result;
}

function findLastStartingBefore(layout: VirtualLayoutItem[], position: number) {
  let low = 0;
  let high = layout.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (layout[middle].start <= position) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

export const VirtualDynamicList = forwardRef(function VirtualDynamicList<T>(
  {
    className = "",
    estimateSize,
    followEnd,
    itemKey,
    items,
    overscan = DEFAULT_OVERSCAN,
    renderItem,
    rowGap = 0,
    scrollRef,
  }: VirtualDynamicListProps<T>,
  forwardedRef: React.ForwardedRef<VirtualDynamicListHandle>
) {
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const measurementsRef = useRef(new Map<string, number>());
  const observersRef = useRef(new Map<string, ResizeObserver>());
  const rowRefCallbacksRef = useRef(new Map<string, (element: HTMLDivElement | null) => void>());
  const pendingAnchorRef = useRef<PendingAnchor | null>(null);
  const previousLayoutRef = useRef<LayoutSnapshot | null>(null);
  const measurementFrameRef = useRef<number | null>(null);
  const layoutRef = useRef<VirtualLayoutItem[]>([]);
  const estimateSizeRef = useRef(estimateSize);
  const followEndRef = useRef(followEnd);
  const itemKeyRef = useRef(itemKey);
  const measureElementRef = useRef<(key: string, element: HTMLDivElement | null) => void>(() => undefined);
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [viewport, setViewport] = useState({ height: 0, top: 0 });

  estimateSizeRef.current = estimateSize;
  followEndRef.current = followEnd;
  itemKeyRef.current = itemKey;

  const layout = useMemo(() => {
    let cursor = 0;
    const next = items.map((item, index) => {
      const key = itemKeyRef.current(item);
      const measured = measurementsRef.current.get(key);
      const size = Math.max(1, measured ?? estimateSizeRef.current(item, index));
      const row = { key, index, size, start: cursor, end: cursor + size };
      cursor = row.end + (index === items.length - 1 ? 0 : rowGap);
      return row;
    });
    return { items: next, totalSize: Math.max(0, cursor) };
  }, [items, measurementVersion, rowGap]);

  layoutRef.current = layout.items;

  const readViewport = () => {
    const scroller = scrollRef.current;
    const spacer = spacerRef.current;
    if (!scroller || !spacer) return { height: 0, top: 0 };
    return {
      height: scroller.clientHeight,
      top: Math.max(0, scroller.scrollTop - spacer.offsetTop),
    };
  };

  const updateViewport = () => {
    const next = readViewport();
    setViewport((current) => current.height === next.height && Math.abs(current.top - next.top) < 0.5 ? current : next);
  };

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const spacer = spacerRef.current;
    if (!scroller || !spacer) return;

    const pending = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    const previous = previousLayoutRef.current;

    if (pending) {
      if (pending.followEnd) {
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        const anchor = layout.items.find((item) => item.key === pending.key);
        if (anchor) scroller.scrollTop = spacer.offsetTop + anchor.start + pending.offset;
      }
    } else if (previous?.items.length && layout.items.length) {
      const previousViewportTop = Math.max(0, scroller.scrollTop - previous.spacerOffset);
      const previousAnchorIndex = Math.min(
        Math.max(0, findFirstEndingAfter(previous.items, previousViewportTop)),
        previous.items.length - 1
      );
      const wasAtEnd = previous.spacerOffset + previous.totalSize - scroller.scrollTop - scroller.clientHeight <= 3;

      if (wasAtEnd && followEndRef.current?.()) {
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        for (let index = previousAnchorIndex; index < previous.items.length; index += 1) {
          const previousAnchor = previous.items[index];
          const nextAnchor = layout.items.find((item) => item.key === previousAnchor.key);
          if (!nextAnchor) continue;
          const anchorOffset = previousViewportTop - previousAnchor.start;
          const nextScrollTop = spacer.offsetTop + nextAnchor.start + anchorOffset;
          if (Math.abs(nextScrollTop - scroller.scrollTop) >= 0.5) scroller.scrollTop = nextScrollTop;
          break;
        }
      }
    }

    previousLayoutRef.current = {
      items: layout.items,
      spacerOffset: spacer.offsetTop,
      totalSize: layout.totalSize,
    };
    updateViewport();
  }, [layout.items, layout.totalSize, scrollRef]);

  useEffect(() => {
    const validKeys = new Set(items.map((item) => itemKeyRef.current(item)));
    for (const key of measurementsRef.current.keys()) {
      if (!validKeys.has(key)) measurementsRef.current.delete(key);
    }
    for (const key of rowRefCallbacksRef.current.keys()) {
      if (!validKeys.has(key)) rowRefCallbacksRef.current.delete(key);
    }
  }, [items]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const scheduleViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateViewport);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleViewport);
    observer?.observe(scroller);
    scroller.addEventListener("scroll", scheduleViewport, { passive: true });
    scheduleViewport();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      scroller.removeEventListener("scroll", scheduleViewport);
    };
  }, [scrollRef]);

  useEffect(() => () => {
    if (measurementFrameRef.current !== null) cancelAnimationFrame(measurementFrameRef.current);
    observersRef.current.forEach((observer) => observer.disconnect());
    observersRef.current.clear();
  }, []);

  const captureAnchor = () => {
    if (pendingAnchorRef.current) return;
    const currentLayout = layoutRef.current;
    const currentViewport = readViewport();
    const anchorIndex = Math.min(
      Math.max(0, findFirstEndingAfter(currentLayout, currentViewport.top)),
      Math.max(0, currentLayout.length - 1)
    );
    const anchor = currentLayout[anchorIndex];
    if (!anchor) return;
    const scroller = scrollRef.current;
    const nearEnd = scroller ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 3 : false;
    pendingAnchorRef.current = {
      key: anchor.key,
      offset: currentViewport.top - anchor.start,
      followEnd: nearEnd && Boolean(followEndRef.current?.()),
    };
  };

  const scheduleMeasurementCommit = () => {
    if (measurementFrameRef.current !== null) return;
    measurementFrameRef.current = requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      setMeasurementVersion((version) => version + 1);
    });
  };

  const measureElement = (key: string, element: HTMLDivElement | null) => {
    observersRef.current.get(key)?.disconnect();
    observersRef.current.delete(key);
    if (!element || typeof ResizeObserver === "undefined") return;

    const commit = () => {
      const nextSize = Math.ceil(element.getBoundingClientRect().height);
      if (!nextSize || measurementsRef.current.get(key) === nextSize) return;
      captureAnchor();
      measurementsRef.current.set(key, nextSize);
      scheduleMeasurementCommit();
    };
    const observer = new ResizeObserver(commit);
    observer.observe(element);
    observersRef.current.set(key, observer);
    commit();
  };

  measureElementRef.current = measureElement;

  const getRowRef = (key: string) => {
    const current = rowRefCallbacksRef.current.get(key);
    if (current) return current;
    const callback = (element: HTMLDivElement | null) => measureElementRef.current(key, element);
    rowRefCallbacksRef.current.set(key, callback);
    return callback;
  };

  const scrollToIndex = (index: number, alignment: VirtualListAlignment = "center", behavior: ScrollBehavior = "auto") => {
    const scroller = scrollRef.current;
    const spacer = spacerRef.current;
    const item = layout.items[index];
    if (!scroller || !spacer || !item) return false;

    const viewportHeight = scroller.clientHeight;
    const itemTop = spacer.offsetTop + item.start;
    const itemBottom = spacer.offsetTop + item.end;
    let target = itemTop;
    if (alignment === "center") target = itemTop - (viewportHeight - item.size) / 2;
    if (alignment === "end") target = itemBottom - viewportHeight;
    if (alignment === "nearest") {
      const viewportTop = scroller.scrollTop;
      const viewportBottom = viewportTop + viewportHeight;
      if (itemTop >= viewportTop && itemBottom <= viewportBottom) return true;
      target = itemTop < viewportTop ? itemTop : itemBottom - viewportHeight;
    }
    const bounded = Math.max(0, Math.min(target, scroller.scrollHeight - viewportHeight));
    scroller.scrollTo({ top: bounded, behavior });
    setViewport({ height: viewportHeight, top: Math.max(0, bounded - spacer.offsetTop) });
    return true;
  };

  useImperativeHandle(forwardedRef, () => ({
    scrollToEnd(behavior: ScrollBehavior = "auto") {
      const scroller = scrollRef.current;
      if (!scroller) return;
      scroller.scrollTo({ top: scroller.scrollHeight, behavior });
      updateViewport();
    },
    scrollToIndex,
  }), [layout.items, scrollRef]);

  const rangeStart = Math.max(0, viewport.top - overscan);
  const rangeEnd = viewport.top + viewport.height + overscan;
  const startIndex = layout.items.length ? Math.min(layout.items.length - 1, findFirstEndingAfter(layout.items, rangeStart)) : 0;
  const endIndex = layout.items.length ? Math.max(startIndex, findLastStartingBefore(layout.items, rangeEnd)) : -1;
  const visibleItems = endIndex >= startIndex ? layout.items.slice(startIndex, endIndex + 1) : [];

  return (
    <div
      aria-rowcount={items.length}
      className={`virtual-dynamic-list ${className}`.trim()}
      ref={spacerRef}
      role="rowgroup"
      style={{ height: layout.totalSize }}
    >
      {visibleItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        return (
          <div
            aria-rowindex={virtualItem.index + 1}
            className="virtual-dynamic-list-row"
            data-virtual-index={virtualItem.index}
            key={virtualItem.key}
            ref={getRowRef(virtualItem.key)}
            role="row"
            style={{ transform: `translate3d(0, ${virtualItem.start}px, 0)` }}
          >
            {renderItem(item, virtualItem.index)}
          </div>
        );
      })}
    </div>
  );
}) as <T>(props: VirtualDynamicListProps<T> & { ref?: React.ForwardedRef<VirtualDynamicListHandle> }) => ReactNode;
