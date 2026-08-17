export interface Broadcaster {
  userId: string;
  name: string;
}

export interface PresenceState {
  onlineCount: number;
  broadcasters: Broadcaster[];
}
