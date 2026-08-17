import { useEffect, useRef } from "react";
import { useRoom } from "../context/RoomContext";

export function SharingBanner() {
  const { isSharing, localStream, stopShare } = useRoom();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!isSharing) return null;

  return (
    <div className="sharing-banner">
      <video ref={videoRef} autoPlay playsInline muted className="sharing-banner-preview" />
      <div className="sharing-banner-text">
        <span className="live-dot" />
        Você está compartilhando sua tela
      </div>
      <button className="btn btn-danger btn-sm" onClick={stopShare}>
        Parar compartilhamento
      </button>
    </div>
  );
}
