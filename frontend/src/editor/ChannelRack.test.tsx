import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChannelRack } from "./ChannelRack";
import type { MixerChannel, Track } from "./editorStore";

const tracks: Track[] = [
  { id: "track-1", name: "Batterie", kind: "drums", gain: 1, pan: 0 },
  { id: "track-2", name: "Basse", kind: "bass", gain: 0.8, pan: -0.2 },
];

const channels: MixerChannel[] = [
  { id: "ch-1", track_id: "track-1", gain: 1, pan: 0, mute: true, solo: false, output: "master", sends: {}, effects: [] },
];

describe("ChannelRack", () => {
  afterEach(cleanup);

  it("affiche chaque piste avec son type et ses réglages", () => {
    render(
      <ChannelRack
        tracks={tracks}
        channels={channels}
        selectedIds={[]}
        onSelect={vi.fn()}
        onToggleMute={vi.fn()}
        onToggleSolo={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Batterie drums" })).toBeInTheDocument();
    expect(screen.getByText("drums")).toBeInTheDocument();
    expect(screen.getByText(/gain 80 % · pan -20 %/)).toBeInTheDocument();
  });

  it("reflète l’état du canal mixer sur les boutons", () => {
    render(
      <ChannelRack
        tracks={tracks}
        channels={channels}
        selectedIds={[]}
        onSelect={vi.fn()}
        onToggleMute={vi.fn()}
        onToggleSolo={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Batterie — Son activé" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Batterie — Solo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Basse — Muet" })).toHaveAttribute("aria-pressed", "false");
  });

  it("basculle mute et solo vers le parent", () => {
    const onToggleMute = vi.fn();
    const onToggleSolo = vi.fn();
    render(
      <ChannelRack
        tracks={tracks}
        channels={channels}
        selectedIds={[]}
        onSelect={vi.fn()}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Batterie — Son activé" }));
    expect(onToggleMute).toHaveBeenCalledWith("track-1");
    fireEvent.click(screen.getByRole("button", { name: "Basse — Solo" }));
    expect(onToggleSolo).toHaveBeenCalledWith("track-2");
  });

  it("signale la piste sélectionnée et sélectionne au clic", () => {
    const onSelect = vi.fn();
    render(
      <ChannelRack
        tracks={tracks}
        channels={[]}
        selectedIds={["track-2"]}
        onSelect={onSelect}
        onToggleMute={vi.fn()}
        onToggleSolo={vi.fn()}
      />,
    );
    const selected = screen.getByRole("button", { name: "Basse bass" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(selected);
    expect(onSelect).toHaveBeenCalledWith("track-2", false);
  });
});
