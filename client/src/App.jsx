import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { io } from "socket.io-client";
import Home from "./Home.jsx";
import Room from "./Room.jsx";

const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:3001", {
  autoConnect: true,
  reconnection: true
});

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home socket={socket} connected={connected} />} />
      <Route path="/room/:roomCode" element={<Room socket={socket} connected={connected} />} />
      <Route path="*" element={<Home socket={socket} connected={connected} />} />
    </Routes>
  );
}
