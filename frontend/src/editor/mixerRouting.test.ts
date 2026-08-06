import { array, assert, constantFrom, dictionary, double, integer, property, record } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  hasMixerCycle,
  wouldOutputCreateCycle,
  wouldSendCreateCycle,
  type RoutingChannel,
} from "./mixerRouting";

describe("hasMixerCycle", () => {
  it("accepts an acyclic chain of channels routed toward master", () => {
    assert(
      property(integer({ min: 1, max: 12 }), (count) => {
        const channels: RoutingChannel[] = Array.from({ length: count }, (_, index) => ({
          id: `c${index}`,
          output: index === count - 1 ? "master" : `c${index + 1}`,
          sends: {},
        }));
        expect(hasMixerCycle(channels)).toBe(false);
      }),
    );
  });

  it("detects a cycle closed by output routing", () => {
    assert(
      property(integer({ min: 2, max: 12 }), (count) => {
        const channels: RoutingChannel[] = Array.from({ length: count }, (_, index) => ({
          id: `c${index}`,
          output: `c${(index + 1) % count}`,
          sends: {},
        }));
        expect(hasMixerCycle(channels)).toBe(true);
      }),
    );
  });

  it("detects a cycle closed by a send", () => {
    const channels: RoutingChannel[] = [
      { id: "a", output: "master", sends: { b: 0.5 } },
      { id: "b", output: "master", sends: { a: 0.5 } },
    ];
    expect(hasMixerCycle(channels)).toBe(true);
  });

  it("ignores unknown targets and never throws", () => {
    assert(
      property(
        array(
          record({
            id: constantFrom("a", "b", "c", "d"),
            output: constantFrom("a", "b", "c", "d", "master", "unknown"),
            sends: dictionary(constantFrom("a", "b", "c", "d", "unknown"), double({ min: 0, max: 1, noNaN: true })),
          }),
          { minLength: 0, maxLength: 8 },
        ),
        (rows) => {
          const seen = new Set<string>();
          const channels = rows.filter((row) => (seen.has(row.id) ? false : seen.add(row.id)));
          expect(() => hasMixerCycle(channels)).not.toThrow();
        },
      ),
    );
  });
});

describe("wouldOutputCreateCycle / wouldSendCreateCycle", () => {
  it("rejects an output that would point back at an ancestor", () => {
    const channels: RoutingChannel[] = [
      { id: "a", output: "b", sends: {} },
      { id: "b", output: "master", sends: {} },
    ];
    expect(wouldOutputCreateCycle(channels, "b", "a")).toBe(true);
  });

  it("accepts an output toward a channel that is not an ancestor", () => {
    const channels: RoutingChannel[] = [
      { id: "a", output: "master", sends: {} },
      { id: "b", output: "master", sends: {} },
    ];
    expect(wouldOutputCreateCycle(channels, "a", "b")).toBe(false);
  });

  it("rejects a send that would point back at an ancestor", () => {
    const channels: RoutingChannel[] = [
      { id: "a", output: "b", sends: {} },
      { id: "b", output: "master", sends: {} },
    ];
    expect(wouldSendCreateCycle(channels, "b", "a")).toBe(true);
  });
});
