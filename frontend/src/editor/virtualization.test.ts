import { describe, expect, it } from "vitest";

import { computeVirtualWindow } from "./virtualization";

const base = { itemCount: 5000, viewportHeight: 440, rowHeight: 44, scrollTop: 0, overscan: 4 };

describe("computeVirtualWindow", () => {
  it("ne rend qu’une fenêtre étroite d’une très grande liste", () => {
    const frame = computeVirtualWindow(base);

    expect(frame.startIndex).toBe(0);
    expect(frame.endIndex - frame.startIndex).toBeLessThanOrEqual(20);
    expect(frame.endIndex).toBeGreaterThan(0);
    expect(frame.totalHeight).toBe(5000 * 44);
  });

  it("fait avancer la fenêtre avec le défilement", () => {
    const frame = computeVirtualWindow({ ...base, scrollTop: 2200 });

    expect(frame.startIndex).toBe(46);
    expect(frame.endIndex).toBe(64);
  });

  it("borne la fenêtre en fin de liste", () => {
    const frame = computeVirtualWindow({ ...base, scrollTop: 5000 * 44 });

    expect(frame.startIndex).toBeLessThan(frame.endIndex);
    expect(frame.endIndex).toBe(5000);
  });

  it("inclut l’overscan autour de la vue", () => {
    const frame = computeVirtualWindow({ ...base, scrollTop: 0, overscan: 10 });

    expect(frame.startIndex).toBe(0);
    expect(frame.endIndex).toBe(30);
  });

  it("retourne une fenêtre vide pour une liste vide ou des dimensions invalides", () => {
    expect(computeVirtualWindow({ ...base, itemCount: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      totalHeight: 0,
    });
    expect(computeVirtualWindow({ ...base, viewportHeight: 0 }).endIndex).toBe(0);
    expect(computeVirtualWindow({ ...base, rowHeight: 0 }).endIndex).toBe(0);
  });
});