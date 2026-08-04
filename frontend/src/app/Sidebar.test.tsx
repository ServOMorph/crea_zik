import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("marque uniquement la route active avec aria-current", () => {
    render(<Sidebar route="editor" collapsed={false} onToggle={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Éditeur musical" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Studio" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Plugins" })).not.toHaveAttribute("aria-current");
  });

  it("repli puis déplie la navigation", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <Sidebar route="studio" collapsed={false} onToggle={onToggle} onNavigate={vi.fn()} />,
    );

    expect(screen.getByText("Crea Zik")).toBeVisible();
    expect(screen.getByRole("button", { name: "Replier la navigation" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Replier la navigation" }));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<Sidebar route="studio" collapsed onToggle={onToggle} onNavigate={vi.fn()} />);
    expect(screen.queryByText("Crea Zik")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Déplier la navigation" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Navigation principale" }).closest("aside")).toHaveClass(
      "sidebar--collapsed",
    );
  });

  it("signale la navigation au clic sans suivre le href", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Sidebar route="studio" collapsed={false} onToggle={vi.fn()} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("link", { name: "Plugins" }));
    expect(onNavigate).toHaveBeenCalledWith("plugins");
    expect(window.location.pathname).toBe("/");
  });
});