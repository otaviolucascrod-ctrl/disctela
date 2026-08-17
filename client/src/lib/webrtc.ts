// Centralized WebRTC configuration. Add TURN servers here later if needed.
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
