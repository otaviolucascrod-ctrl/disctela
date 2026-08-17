import { RoomProvider, useRoom } from "./context/RoomContext";
import { LoginScreen } from "./components/LoginScreen";
import { MainApp } from "./components/MainApp";

function Shell() {
  const { joined } = useRoom();
  return joined ? <MainApp /> : <LoginScreen />;
}

export default function App() {
  return (
    <RoomProvider>
      <Shell />
    </RoomProvider>
  );
}
