import type { MixerChannel, Track } from "./editorStore";

export type ChannelRackRowProps = {
  track: Track;
  channel?: MixerChannel;
  selected: boolean;
  onSelect: (trackId: string, additive: boolean) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
};

export function ChannelRackRow({ track, channel, selected, onSelect, onToggleMute, onToggleSolo }: ChannelRackRowProps) {
  const muted = channel?.mute ?? false;
  const soloed = channel?.solo ?? false;
  return (
    <div className={`channel-rack__row${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="channel-rack__name"
        aria-pressed={selected}
        onClick={(event) => onSelect(track.id, event.ctrlKey || event.metaKey)}
      >
        {track.name}
        <span className="channel-rack__kind">{track.kind}</span>
      </button>
      <span className="channel-rack__meter">
        gain {Math.round((channel?.gain ?? track.gain ?? 1) * 100)} % · pan{" "}
        {Math.round((channel?.pan ?? track.pan ?? 0) * 100)} %
      </span>
      <button
        type="button"
        className="channel-rack__flag"
        aria-pressed={muted}
        aria-label={`${track.name} — ${muted ? "Son activé" : "Muet"}`}
        onClick={() => onToggleMute(track.id)}
      >
        {muted ? "Son activé" : "Muet"}
      </button>
      <button
        type="button"
        className="channel-rack__flag"
        aria-pressed={soloed}
        aria-label={`${track.name} — ${soloed ? "Retirer le solo" : "Solo"}`}
        onClick={() => onToggleSolo(track.id)}
      >
        {soloed ? "Retirer le solo" : "Solo"}
      </button>
    </div>
  );
}

type ChannelRackProps = {
  tracks: Track[];
  channels: MixerChannel[];
  selectedIds: string[];
  onSelect: (trackId: string, additive: boolean) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
};

export function ChannelRack({ tracks, channels, selectedIds, onSelect, onToggleMute, onToggleSolo }: ChannelRackProps) {
  return (
    <div className="channel-rack" role="list" aria-label="Channel Rack">
      {tracks.map((track) => (
        <ChannelRackRow
          key={track.id}
          track={track}
          channel={channels.find((item) => item.track_id === track.id)}
          selected={selectedIds.includes(track.id)}
          onSelect={onSelect}
          onToggleMute={onToggleMute}
          onToggleSolo={onToggleSolo}
        />
      ))}
    </div>
  );
}
