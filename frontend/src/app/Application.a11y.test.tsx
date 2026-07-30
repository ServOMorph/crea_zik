import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { Application } from "./Application";

describe("Application accessibility", () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
  });

  it("has no automatically detectable accessibility violations on the studio shell", async () => {
    const { container } = render(<Application studioPage={<div>Studio</div>} />);

    const results = await axe.run(container, {
      rules: {
        // jsdom does not compute real layout/paint, contrast checks are meaningless here.
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });

  it("has no automatically detectable accessibility violations on the editor shell", async () => {
    window.history.pushState({}, "", "/editor");
    const { container } = render(<Application studioPage={<div>Studio</div>} />);

    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
