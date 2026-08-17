import { useRoom } from "../context/RoomContext";
import type { Broadcaster } from "../types";

export function BroadcastList() {
  const { broadcasters, myUserId, watchingBroadcaster, watch } = useRoom();
  const others = broadcasters.filter((b) => b.userId !== myUserId);

  return (
    <section className="broadcast-list">
      <h2 className="section-title">Telas disponíveis</h2>
      {others.length === 0 ? (
        <p className="broadcast-list-empty">Ninguém está compartilhando a tela agora.</p>
      ) : (
        <div className="broadcast-grid">
          {others.map((b) => (
            <BroadcasterCard
              key={b.userId}
              broadcaster={b}
              active={watchingBroadcaster?.userId === b.userId}
              onWatch={() => watch(b)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BroadcasterCard({
  broadcaster,
  active,
  onWatch,
}: {
  broadcaster: Broadcaster;
  active: boolean;
  onWatch: () => void;
}) {
  return (
    <div className={`broadcaster-card ${active ? "is-active" : ""}`}>
      <div className="broadcaster-card-info">
        <span className="avatar">{broadcaster.name.charAt(0).toUpperCase()}</span>
        <div>
          <div className="broadcaster-name">{broadcaster.name}</div>
          <div className="broadcaster-status">
            <span className="live-dot" />
            Compartilhando agora
          </div>
        </div>
      </div>
      <button className={`btn ${active ? "btn-active" : "btn-secondary"}`} onClick={onWatch}>
        {active ? "Assistindo" : "Assistir"}
      </button>
    </div>
  );
}
