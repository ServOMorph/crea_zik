export type RoutingChannel = {
  id: string;
  output: string;
  sends: Record<string, number>;
};

export function hasMixerCycle(channels: RoutingChannel[]): boolean {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const channel = byId.get(id);
    if (channel) {
      const targets = Object.keys(channel.sends);
      if (channel.output !== "master") targets.push(channel.output);
      for (const target of targets) {
        if (byId.has(target) && visit(target)) return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return channels.some((channel) => visit(channel.id));
}

export function wouldOutputCreateCycle(
  channels: RoutingChannel[],
  channelId: string,
  proposedOutput: string,
): boolean {
  const next = channels.map((channel) =>
    channel.id === channelId ? { ...channel, output: proposedOutput } : channel,
  );
  return hasMixerCycle(next);
}

export function wouldSendCreateCycle(
  channels: RoutingChannel[],
  channelId: string,
  targetId: string,
): boolean {
  const next = channels.map((channel) =>
    channel.id === channelId
      ? { ...channel, sends: { ...channel.sends, [targetId]: 1 } }
      : channel,
  );
  return hasMixerCycle(next);
}
