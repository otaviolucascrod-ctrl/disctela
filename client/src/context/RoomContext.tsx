import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { socket } from "../lib/socket";
import { RTC_CONFIG } from "../lib/webrtc";
import type { Broadcaster, PresenceState } from "../types";

type JoinResult = { ok: true } | { ok: false; error: string };

interface RoomContextValue {
  connected: boolean;
  joined: boolean;
  joining: boolean;
  myUserId: string | null;
  myName: string | null;
  onlineCount: number;
  broadcasters: Broadcaster[];
  isSharing: boolean;
  localStream: MediaStream | null;
  watchingBroadcaster: Broadcaster | null;
  remoteStream: MediaStream | null;
  notice: string | null;
  join: (name: string) => Promise<JoinResult>;
  leave: () => void;
  startShare: () => Promise<void>;
  stopShare: () => void;
  watch: (broadcaster: Broadcaster) => Promise<void>;
  stopWatching: () => void;
  dismissNotice: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceState>({ onlineCount: 0, broadcasters: [] });
  const [isSharing, setIsSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [watchingBroadcaster, setWatchingBroadcaster] = useState<Broadcaster | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const myUserIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const watchingIdRef = useRef<string | null>(null);
  const broadcasterPeers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPeer = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  const closeViewerPeer = useCallback(() => {
    viewerPeer.current?.close();
    viewerPeer.current = null;
    watchingIdRef.current = null;
    setWatchingBroadcaster(null);
    setRemoteStream(null);
  }, []);

  const closeAllBroadcasterPeers = useCallback(() => {
    for (const pc of broadcasterPeers.current.values()) pc.close();
    broadcasterPeers.current.clear();
  }, []);

  // ---- socket connection lifecycle ----
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setJoined(false);
      setMyUserId(null);
      setIsSharing(false);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      closeAllBroadcasterPeers();
      closeViewerPeer();
    };
    const onPresence = (state: PresenceState) => setPresence(state);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("presence-update", onPresence);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("presence-update", onPresence);
    };
  }, [closeAllBroadcasterPeers, closeViewerPeer]);

  // ---- broadcaster-side signaling ----
  useEffect(() => {
    const onWatchRequest = async ({ viewerId }: { viewerId: string; viewerName: string }) => {
      if (!localStreamRef.current) return;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      broadcasterPeers.current.set(viewerId, pc);

      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { targetId: viewerId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          broadcasterPeers.current.delete(viewerId);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { targetId: viewerId, sdp: offer });
    };

    const onViewerLeft = ({ viewerId }: { viewerId: string }) => {
      const pc = broadcasterPeers.current.get(viewerId);
      pc?.close();
      broadcasterPeers.current.delete(viewerId);
    };

    socket.on("watch-request", onWatchRequest);
    socket.on("viewer-left", onViewerLeft);
    return () => {
      socket.off("watch-request", onWatchRequest);
      socket.off("viewer-left", onViewerLeft);
    };
  }, []);

  // ---- viewer-side signaling ----
  useEffect(() => {
    const onOffer = async ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      if (fromId !== watchingIdRef.current || !viewerPeer.current) return;
      const pc = viewerPeer.current;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { targetId: fromId, sdp: answer });
    };

    const onAnswer = async ({ fromId, sdp }: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = broadcasterPeers.current.get(fromId);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    const onIceCandidate = async ({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) => {
      const asBroadcasterPc = broadcasterPeers.current.get(fromId);
      if (asBroadcasterPc) {
        try {
          await asBroadcasterPc.addIceCandidate(candidate);
        } catch {
          /* ignore late candidates */
        }
        return;
      }
      if (fromId === watchingIdRef.current && viewerPeer.current) {
        try {
          await viewerPeer.current.addIceCandidate(candidate);
        } catch {
          /* ignore late candidates */
        }
      }
    };

    const onShareEnded = ({ broadcasterId }: { broadcasterId: string }) => {
      if (broadcasterId !== watchingIdRef.current) return;
      closeViewerPeer();
      setNotice("A transmissão terminou.");
    };

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("share-ended", onShareEnded);
    return () => {
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("share-ended", onShareEnded);
    };
  }, [closeViewerPeer]);

  const join = useCallback((name: string): Promise<JoinResult> => {
    setJoining(true);
    return new Promise((resolve) => {
      if (!socket.connected) socket.connect();
      socket.emit("user-join", { name }, (res: any) => {
        setJoining(false);
        if (res?.ok) {
          setMyUserId(res.userId);
          setMyName(res.name);
          setPresence({ onlineCount: res.onlineCount, broadcasters: res.broadcasters });
          setJoined(true);
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: res?.error || "unknown_error" });
        }
      });
    });
  }, []);

  const leave = useCallback(() => {
    socket.disconnect();
  }, []);

  const startShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsSharing(true);
    socket.emit("share-start");

    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      videoTrack.onended = () => {
        stopShareInternal();
      };
    }
  }, []);

  const stopShareInternal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setIsSharing(false);
    closeAllBroadcasterPeers();
    socket.emit("share-stop");
  }, [closeAllBroadcasterPeers]);

  const stopShare = useCallback(() => {
    stopShareInternal();
  }, [stopShareInternal]);

  const watch = useCallback(
    async (broadcaster: Broadcaster) => {
      if (watchingIdRef.current === broadcaster.userId) return;
      if (watchingIdRef.current) {
        socket.emit("stop-watching", { broadcasterId: watchingIdRef.current });
        closeViewerPeer();
      }

      watchingIdRef.current = broadcaster.userId;
      setWatchingBroadcaster(broadcaster);
      setRemoteStream(null);

      const pc = new RTCPeerConnection(RTC_CONFIG);
      viewerPeer.current = pc;

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { targetId: broadcaster.userId, candidate: event.candidate });
        }
      };

      socket.emit("watch-request", { broadcasterId: broadcaster.userId });
    },
    [closeViewerPeer]
  );

  const stopWatching = useCallback(() => {
    if (watchingIdRef.current) {
      socket.emit("stop-watching", { broadcasterId: watchingIdRef.current });
    }
    closeViewerPeer();
  }, [closeViewerPeer]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const value: RoomContextValue = {
    connected,
    joined,
    joining,
    myUserId,
    myName,
    onlineCount: presence.onlineCount,
    broadcasters: presence.broadcasters,
    isSharing,
    localStream,
    watchingBroadcaster,
    remoteStream,
    notice,
    join,
    leave,
    startShare,
    stopShare,
    watch,
    stopWatching,
    dismissNotice,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}
