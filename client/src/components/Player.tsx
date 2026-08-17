import { useEffect, useRef } from "react";
import { useRoom } from "../context/RoomContext";

export function Player() {
  const { watchingBroadcaster, remoteStream, stopWatching } = useRoom();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!watchingBroadcaster) {
    return (
      <div className="player-empty">
        <div className="player-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h3>Nenhuma tela selecionada</h3>
        <p>Acompanhe uma das transmissões disponíveis.</p>
      </div>
    );
  }

  const handleFullscreen = () => {
    wrapRef.current?.requestFullscreen?.();
  };

  return (
    <div className="player" ref={wrapRef}>
      <div className="player-header">
        <div>
          <span className="player-eyebrow">Assistindo</span>
          <div className="player-title">
            <span className="live-dot" />
            {watchingBroadcaster.name}
          </div>
        </div>
        <span className="live-badge">AO VIVO</span>
      </div>

      <div className="player-stage">
        <video ref={videoRef} autoPlay playsInline className="player-video" />
      </div>

      <div className="player-controls">
        <button className="btn btn-secondary" onClick={handleFullscreen}>
          Tela cheia
        </button>
        <button className="btn btn-ghost" onClick={stopWatching}>
          Parar de assistir
        </button>
      </div>
    </div>
  );
}
