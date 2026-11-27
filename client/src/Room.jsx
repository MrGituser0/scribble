import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clipboard, Crown, DoorOpen, LoaderCircle, MessageCircle, Send, Sparkles, Timer, Trophy, UserMinus, Users, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar } from "./Avatar.jsx";
import { usePlayer } from "./store.js";
import DrawCanvas from "./DrawCanvas.jsx";

export default function Room({ socket, connected }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { profile } = usePlayer();
  const [room, setRoom] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [chatText, setChatText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [kicking, setKicking] = useState("");
  const chatEndRef = useRef(null);

  const leaveRoom = useCallback(() => {
    socket.emit("room:leave");
    navigate("/");
  }, [navigate, socket]);

  useEffect(() => {
    setRoom(null);
    setError("");
    const onState = (next) => {
      if (next.code !== roomCode.toUpperCase()) return;
      setRoom(next);
      setTimeLeft(next.timeLeft);
    };
    const onTimer = (seconds) => setTimeLeft(seconds);
    const onKicked = ({ message }) => {
      socket.emit("room:leave");
      setError(message || "You were removed from the room.");
      navigate("/");
    };
    socket.on("room:state", onState);
    socket.on("game:timer", onTimer);
    socket.on("room:kicked", onKicked);
    socket.emit("room:join", { code: roomCode, profile }, (result) => {
      if (!result?.ok) {
        setError(result?.error || "Could not join this room.");
        return;
      }
    });
    return () => {
      socket.off("room:state", onState);
      socket.off("game:timer", onTimer);
      socket.off("room:kicked", onKicked);
    };
  }, [navigate, profile, roomCode, socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages?.length]);

  const me = useMemo(() => room?.players?.find((player) => player.id === socket.id), [room?.players, socket.id]);
  const isHost = me?.isHost;
  const isArtist = room?.status === "playing" && room.artistId === socket.id;
  const sendMessage = (event) => {
    event.preventDefault();
    if (!chatText.trim()) return;
    socket.emit("game:chat", { text: chatText }, (result) => {
      if (result && !result.ok) setError(result.error);
      else setError("");
    });
    setChatText("");
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      setError("Could not copy the invite link. You can share the room code instead.");
    }
  };
  const startGame = () => {
    setError("");
    socket.emit("room:start", {}, (result) => {
      if (!result?.ok) setError(result?.error || "Could not start the game.");
    });
  };
  const kickPlayer = (playerId) => {
    socket.emit("room:kick", { playerId }, (result) => {
      setKicking("");
      if (!result?.ok) setError(result?.error);
    });
  };

  if (!room && !error) {
    return <main className="room-loading"><LoaderCircle className="spin" size={30} /><p>Warming up the doodle room...</p></main>;
  }
  if (!room) {
    return <main className="room-loading"><p className="room-error">{error}</p><button className="primary-button" onClick={() => navigate("/")}>BACK HOME <ArrowLeft size={17} /></button></main>;
  }

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const timePercent = Math.max(0, (timeLeft / room.settings.drawTime) * 100);
  const sendButtonDisabled = !chatText.trim() || !connected;

  return (
    <main className="game-shell">
      <header className="game-header">
        <a className="brand game-brand" href="/"><span className="brand-mark"><span>✎</span></span><span>doodle<span className="brand-pop">dash</span></span></a>
        <div className="game-meta">
          <span className="round-chip"><Sparkles size={14} /> ROUND {room.round || 0}<i>/</i>{room.totalRounds}</span>
          <span className={`timer-chip ${timeLeft <= 10 && room.status === "playing" ? "timer-warning" : ""}`}><Timer size={15} />{room.status === "playing" ? `${timeLeft}s` : "—"}</span>
          <span className="player-count"><Users size={15} />{room.players.length}/{room.settings.maxPlayers}</span>
        </div>
        <div className="game-top-actions">
          <button className="room-code-chip" onClick={copyInvite} title="Copy invite link"><span>ROOM</span><strong>{room.code}</strong>{copied ? <Check size={14} /> : <Clipboard size={14} />}</button>
          <button className="leave-button" onClick={leaveRoom}><DoorOpen size={16} /><span>Leave</span></button>
        </div>
      </header>

      <div className="game-layout">
        <aside className="leaderboard panel-card">
          <div className="panel-title"><span><Trophy size={17} /> THE DOODLE BOARD</span><span className="live-tag"><i /> LIVE</span></div>
          <div className="leaderboard-list">
            {sortedPlayers.map((player, index) => <div key={player.id} className={`leader-player ${player.id === socket.id ? "self-player" : ""} ${player.isArtist ? "artist-player" : ""}`}>
              <span className={`rank rank-${index + 1}`}>{index === 0 && player.score > 0 ? <Crown size={13} /> : index + 1}</span><Avatar>{player.avatar}</Avatar>
              <span className="leader-name">{player.name}{player.isHost ? <small>HOST</small> : null}{player.id === socket.id ? <small>YOU</small> : null}<span className="leader-status">{player.isArtist ? "✏️ drawing" : player.hasGuessed && room.status === "playing" ? "✓ guessed it" : ""}</span></span>
              <strong className="leader-score">{player.score}</strong>
              {isHost && room.status === "waiting" && player.id !== socket.id && <button className="kick-button" title={`Remove ${player.name}`} onClick={() => setKicking(player.id)}><UserMinus size={14} /></button>}
            </div>)}
            {Array.from({ length: Math.max(0, Math.min(4, room.settings.maxPlayers - room.players.length)) }, (_, index) => <div className="empty-player" key={`empty-${index}`}><span>+</span><i>Waiting for a doodler</i></div>)}
          </div>
          <div className="leaderboard-tip"><span>💡</span> Faster guesses = more points!</div>
        </aside>

        <section className="main-stage">
          {room.status === "waiting" ? <div className="lobby-card panel-card">
            <div className="lobby-confetti">✦　✧　✦</div>
            <span className="lobby-icon">🎨</span>
            <span className="lobby-eyebrow">YOUR ROOM IS READY</span>
            <h1>Waiting for more<br /><em>doodle masters...</em></h1>
            <p>Invite your favorite people and let the doodle-off begin.</p>
            <div className="invite-box"><span><small>ROOM CODE</small><strong>{room.code}</strong></span><button onClick={copyInvite}>{copied ? <><Check size={16} /> COPIED!</> : <><Clipboard size={16} /> COPY INVITE</>}</button></div>
            <div className="lobby-rule"><span>{room.settings.rounds} rounds</span><i>·</i><span>{room.settings.drawTime}s per turn</span><i>·</i><span>{room.settings.difficulty} words</span></div>
            {isHost ? <button className="primary-button start-button" onClick={startGame} disabled={room.players.length < 2}><span>{room.players.length < 2 ? "WAITING FOR A PLAYER" : "LET'S PLAY!"}</span><ArrowRight size={19} /></button> : <div className="waiting-host"><span className="waiting-pulse" /> The host will start the game soon</div>}
            {room.players.length < 2 && <div className="need-player">You need at least one buddy before starting 🧡</div>}
          </div> : room.status === "finished" ? <div className="lobby-card finished-card panel-card">
            <span className="lobby-icon">🏆</span><span className="lobby-eyebrow">THE DOODLE-OFF IS OVER</span><h1>What a bunch of<br /><em>masterpieces!</em></h1>
            <div className="winner-list">{sortedPlayers.slice(0, 3).map((player, index) => <div key={player.id}><b>{["🥇", "🥈", "🥉"][index]}</b><Avatar>{player.avatar}</Avatar><span>{player.name}</span><strong>{player.score} pts</strong></div>)}</div>
            {isHost ? <button className="primary-button start-button" onClick={startGame}>PLAY AGAIN <ArrowRight size={18} /></button> : <div className="waiting-host">Ask the host to start another round!</div>}
          </div> : <div className="play-stage">
            <div className="turn-banner"><span className="turn-avatar">{room.players.find((player) => player.id === room.artistId)?.avatar}</span><div><span className="mini-label">{isArtist ? "IT'S YOUR TURN TO DRAW!" : `${room.players.find((player) => player.id === room.artistId)?.name || "Your buddy"} IS DRAWING`}</span><strong>{isArtist ? "Make us guess it!" : "What could it be?"}</strong></div><div className="turn-score"><span>YOUR SCORE</span><strong>{me?.score || 0}</strong></div></div>
            <div className="timer-progress"><span style={{ width: `${timePercent}%` }} /></div>
            <DrawCanvas socket={socket} isArtist={isArtist} round={`${room.round}-${room.artistId}`} hint={isArtist ? room.word : room.hint} />
          </div>}
          {error && <motion.div className="toast-error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="alert">{error}<button onClick={() => setError("")}><X size={14} /></button></motion.div>}
        </section>

        <aside className="chat-panel panel-card">
          <div className="panel-title chat-title"><span><MessageCircle size={17} /> THE CHATTERBOX</span><span className="chat-online">{room.players.length} pals</span></div>
          <div className="chat-messages">
            {room.messages.map((message) => <div key={message.id} className={`chat-message ${message.type === "system" ? "system-message" : ""} ${message.type === "correct" ? "correct-message" : ""}`}>
              {message.type === "chat" ? <><Avatar>{message.avatar}</Avatar><div><strong>{message.playerName}</strong><p>{message.text}</p></div></> : message.type === "correct" ? <div className="system-copy"><span>🎉</span><strong>{message.text}</strong>{message.points && <small>+{message.points} points</small>}</div> : <div className="system-copy"><span>✦</span><span>{message.text}</span></div>}
            </div>)}
            {room.messages.length === 0 && <div className="chat-empty"><span>💬</span><p>Say hello to your doodle pals!</p></div>}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={sendMessage}>
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder={room.status === "playing" ? isArtist ? "Cheer on the guessers..." : "Type your guess..." : "Say something fun..."} maxLength={160} aria-label="Chat message" />
            <button type="submit" disabled={sendButtonDisabled} aria-label="Send message"><Send size={17} /></button>
          </form>
          <div className="chat-note">{room.status === "playing" && !isArtist ? "💡 Guess in the chat to score points!" : "Be nice, have fun, doodle on!"}</div>
        </aside>
      </div>

      <AnimatePresence>{kicking && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="kick-modal modal-card" initial={{ y: 12, scale: .96 }} animate={{ y: 0, scale: 1 }}><span className="kick-modal-icon">👀</span><h2>Send them packing?</h2><p>They'll be removed from this room.</p><div><button className="secondary-button" onClick={() => setKicking("")}>Never mind</button><button className="danger-button" onClick={() => kickPlayer(kicking)}>Remove player</button></div></motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}
