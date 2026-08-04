import { ReactNode, useState } from "react";

import { computeVirtualWindow } from "./virtualization";

type VirtualListProps<T> = {
  items: readonly T[];
  idFor: (item: T) => string;
  height: number;
  rowHeight: number;
  overscan?: number;
  ariaLabel: string;
  renderRow: (item: T, index: number) => ReactNode;
};

export function VirtualList<T>({
  items,
  idFor,
  height,
  rowHeight,
  overscan = 4,
  ariaLabel,
  renderRow,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const frame = computeVirtualWindow({
    itemCount: items.length,
    viewportHeight: height,
    rowHeight,
    scrollTop,
    overscan,
  });
  const visible = items.slice(frame.startIndex, frame.endIndex);

  return (
    <div
      className="virtual-list"
      style={{ height, overflowY: "auto" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div role="list" aria-label={ariaLabel} style={{ height: frame.totalHeight, position: "relative" }}>
        {visible.map((item, index) => {
          const absoluteIndex = frame.startIndex + index;
          return (
            <div
              key={idFor(item)}
              role="listitem"
              aria-setsize={items.length}
              aria-posinset={absoluteIndex + 1}
              style={{ height: rowHeight, position: "absolute", top: absoluteIndex * rowHeight, left: 0, right: 0 }}
            >
              {renderRow(item, absoluteIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}