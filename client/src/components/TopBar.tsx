import { useRoom } from "../context/RoomContext";

export function TopBar() {
  const { myName, onlineCount, isSharing, startShare, stopShare, leave } = useRoom();

  const handleShareClick = async () => {
    if (isSharing) {
      stopShare();
      return;
    }
    try {
      await startShare();
    } catch {
      // user cancelled the picker or permission was denied — no-op
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="brand-dot" />
        Screen
      </div>

      <div className="topbar-right">
        <span className="online-pill">
          <span className="online-dot" />
          {onlineCount} online
        </span>
        <span className="user-name">{myName}</span>
        <button
          className={`btn ${isSharing ? "btn-danger" : "btn-primary"}`}
          onClick={handleShareClick}
        >
          {isSharing ? "Parar compartilhamento" : "Compartilhar tela"}
        </button>
        <button className="btn btn-ghost" onClick={leave}>
          Sair
        </button>
      </div>
    </header>
  );
}
