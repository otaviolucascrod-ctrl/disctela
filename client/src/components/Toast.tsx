import { useEffect } from "react";
import { useRoom } from "../context/RoomContext";

export function Toast() {
  const { notice, dismissNotice } = useRoom();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, 3200);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;

  return (
    <div className="toast" role="status">
      {notice}
    </div>
  );
}
