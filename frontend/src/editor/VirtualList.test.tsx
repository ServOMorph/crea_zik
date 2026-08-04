import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VirtualList } from "./VirtualList";

const items = Array.from({ length: 5000 }, (_, index) => ({ id: `item-${index}` }));

function renderList() {
  return render(
    <VirtualList
      items={items}
      idFor={(item) => item.id}
      height={440}
      rowHeight={44}
      overscan={4}
      ariaLabel="Grande liste"
      renderRow={(item) => <button type="button">{item.id}</button>}
    />,
  );
}

describe("VirtualList", () => {
  afterEach(() => {
    cleanup();
  });

  it("ne monte qu’un sous-ensemble restreint de la grande liste", () => {
    renderList();

    expect(screen.getAllByRole("listitem").length).toBeLessThanOrEqual(20);
    expect(screen.getByRole("button", { name: "item-0" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "item-4999" })).not.toBeInTheDocument();
  });

  it("affiche les lignes suivantes après un défilement profond", () => {
    const { container } = renderList();
    const scroller = container.querySelector(".virtual-list") as HTMLElement;
    Object.defineProperty(scroller, "scrollTop", { value: 2200, configurable: true });

    fireEvent.scroll(scroller);

    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "item-46" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "item-0" })).not.toBeInTheDocument();
  });

  it("expose la taille totale et la position via l’accessibilité", () => {
    renderList();

    const first = screen.getAllByRole("listitem")[0];
    expect(first).toHaveAttribute("aria-posinset", "1");
    expect(first).toHaveAttribute("aria-setsize", "5000");
  });
});