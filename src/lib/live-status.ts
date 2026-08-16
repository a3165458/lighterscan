export type ConnectionStatus = "connecting" | "live" | "idle";

export function resolveLiveStatus(
  connection: ConnectionStatus,
  hasVisibleData: boolean,
): ConnectionStatus {
  if (hasVisibleData) return "live";
  return connection;
}
