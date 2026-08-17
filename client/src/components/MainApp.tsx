import { TopBar } from "./TopBar";
import { SharingBanner } from "./SharingBanner";
import { Player } from "./Player";
import { BroadcastList } from "./BroadcastList";
import { Toast } from "./Toast";

export function MainApp() {
  return (
    <div className="app-shell">
      <TopBar />
      <SharingBanner />
      <main className="app-main">
        <section className="player-area">
          <Player />
        </section>
        <BroadcastList />
      </main>
      <Toast />
    </div>
  );
}
