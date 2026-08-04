export type VirtualWindow = {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
};

export function computeVirtualWindow(options: {
  itemCount: number;
  viewportHeight: number;
  rowHeight: number;
  scrollTop: number;
  overscan: number;
}): VirtualWindow {
  const { itemCount, viewportHeight, rowHeight, scrollTop, overscan } = options;
  if (itemCount <= 0 || viewportHeight <= 0 || rowHeight <= 0) {
    return { startIndex: 0, endIndex: 0, totalHeight: itemCount > 0 ? itemCount * rowHeight : 0 };
  }
  const overflow = Math.max(0, itemCount - Math.ceil(viewportHeight / rowHeight));
  const startIndex = Math.min(Math.max(0, Math.floor(scrollTop / rowHeight) - overscan), overflow);
  const visibleRows = Math.ceil(viewportHeight / rowHeight);
  const endIndex = Math.min(itemCount, startIndex + visibleRows + 2 * overscan);
  return { startIndex, endIndex, totalHeight: itemCount * rowHeight };
}