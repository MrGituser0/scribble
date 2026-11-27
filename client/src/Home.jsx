import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowRight, Check, DoorOpen, Gamepad2, LoaderCircle, Pencil, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AvatarPicker } from "./Avatar.jsx";
import { usePlayer } from "./store.js";

const defaults = { name: "Doodle den", maxPlayers: 8, rounds: 3, drawTime: 60, difficulty: "mixed", hints: true, isPublic: false, customWords: "" };

export default function Home({ socket, connected }) {
  const navigate = useNavigate();
  const { profile, updateProfile } = usePlayer();
  const [showCreate, setShowCreate] = useState(false);
  const [showAvatars, setShowAvatars] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [matching, setMatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(null);

  useEffect(() => {
    let active = true;
    const getStats = () => fetch(`${import.meta.env.VITE_SERVER_URL || "http://localhost:3001"}/api/stats`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load player count")))
      .then((stats) => { if (active) setOnline(stats.online); })
      .catch((error) => console.warn("Could not load online player count:", error.message));
    getStats();
    const timer = window.setInterval(getStats, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const updateSetting = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const enterRoom = (code) => {
    setMatching(false);
    setBusy(false);
    navigate(`/room/${code}`);
  };
  const createRoom = (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      ...settings,
      customWords: settings.customWords.split(",").map((word) => word.trim()).filter(Boolean)
    };
    socket.emit("room:create", { profile, settings: payload }, (result) => {
      setBusy(false);
      if (!result?.ok) return setError(result?.error || "Could not create a room. Try again.");
      setShowCreate(false);
      enterRoom(result.code);
    });
  };
  const joinRoom = (event) => {
    event.preventDefault();
    setError("");
    if (joinCode.trim().length < 4) return setError("Room codes are 4 letters long.");
    setBusy(true);
    socket.emit("room:join", { code: joinCode, profile }, (result) => {
      setBusy(false);
      if (!result?.ok) return setError(result?.error || "Could not join that room.");
      enterRoom(result.code);
    });
  };
  const quickMatch = () => {
    setError("");
    setMatching(true);
    socket.emit("match:quick", { profile }, (result) => {
      if (!result?.ok) {
        setMatching(false);
        return setError(result?.error || "Matchmaking is having a little wobble. Try again.");
      }
      enterRoom(result.code);
    });
  };

  return (
    <main className="home-shell">
      <div className="home-grain" />
      <header className="site-header">
        <a className="brand" href="/" aria-label="Doodle Dash home">
          <span className="brand-mark"><Pencil size={21} strokeWidth={3} /></span>
          <span>doodle<span className="brand-pop">dash</span><i>®</i></span>
        </a>
        <div className="header-right">
          <span className="online-pill"><span className="live-dot" />{online ?? "—"} doodlers online</span>
          <span className={`connection-pill ${connected ? "connected" : ""}`} title={connected ? "Connected to game server" : "Connecting to game server"}>
            {connected ? "LIVE" : "CONNECTING"}
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-doodle doodle-star">✳</div>
        <div className="hero-doodle doodle-squiggle">〰</div>
        <div className="hero-doodle doodle-sparkle">✦</div>
        <div className="hero-doodle doodle-circle">●</div>
        <div className="hero-copy">
          <motion.div className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Sparkles size={15} /> THE INTERNET'S SILLIEST ART CLUB
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            LET'S DRAW<br /><span>& GUESS!</span>
          </motion.h1>
          <p className="hero-subtitle">Grab your friends, draw something silly,<br className="desktop-break" /> and see who can guess it first!</p>
        </div>
        <div className="hero-art" aria-label="A doodle drawing of a smiling fox and a lightbulb">
          <div className="hero-sun" />
          <motion.div className="floating-bubble bubble-one" animate={{ y: [0, -9, 0], rotate: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 3.2 }}>?</motion.div>
          <motion.div className="floating-bubble bubble-two" animate={{ y: [0, 8, 0], rotate: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.8 }}>✦</motion.div>
          <div className="doodle-card">
            <div className="fox-face"><span className="fox-ear ear-left" /><span className="fox-ear ear-right" /><span className="fox-eye eye-left" /><span className="fox-eye eye-right" /><span className="fox-cheek cheek-left" /><span className="fox-cheek cheek-right" /><span className="fox-nose" /><span className="fox-smile" /></div>
            <div className="fox-caption"><span>is it a fox?</span><i>✎</i></div>
          </div>
          <div className="art-scribble scribble-a">〰</div><div className="art-scribble scribble-b">✷</div>
          <span className="art-sticker sticker-pencil">✏️</span><span className="art-sticker sticker-palette">🎨</span>
        </div>
      </section>

      <section className="play-panel">
        <div className="identity-row">
          <div className="identity-avatar">
            <button type="button" className="avatar-big" onClick={() => setShowAvatars(!showAvatars)} aria-label="Change avatar">{profile.avatar}</button>
            <button type="button" className="avatar-edit" onClick={() => setShowAvatars(!showAvatars)} aria-label="Edit avatar"><Pencil size={12} /></button>
          </div>
          <div className="identity-fields">
            <label htmlFor="player-name">YOUR DOODLE NAME</label>
            <input id="player-name" value={profile.name} maxLength={20} onChange={(event) => updateProfile({ ...profile, name: event.target.value })} placeholder="Name your doodler" />
          </div>
          <div className="avatar-prompt">Pick your<br />character <ArrowDown size={16} /></div>
        </div>
        <AnimatePresence>
          {showAvatars && <motion.div className="home-avatar-picker" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}><AvatarPicker value={profile.avatar} onChange={(avatar) => updateProfile({ ...profile, avatar })} /></motion.div>}
        </AnimatePresence>
        <div className="action-grid">
          <motion.button className="action-card create-action" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => { setError(""); setShowCreate(true); }}>
            <span className="action-icon"><Pencil size={21} /></span><span className="action-copy"><strong>CREATE ROOM</strong><small>Make a room for your crew</small></span><ArrowRight className="action-arrow" size={19} />
          </motion.button>
          <motion.button className="action-card random-action" whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={quickMatch}>
            <span className="action-icon"><Gamepad2 size={22} /></span><span className="action-copy"><strong>PLAY RANDOM</strong><small>Meet new doodle buddies</small></span><ArrowRight className="action-arrow" size={19} />
          </motion.button>
        </div>
        <form className="join-form" onSubmit={joinRoom}>
          <label htmlFor="room-code"><DoorOpen size={16} /> GOT A ROOM CODE?</label>
          <div className="join-field"><input id="room-code" value={joinCode} maxLength={4} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="TYPE CODE" /><button className="join-button" aria-label="Join room" disabled={busy}>{busy ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}</button></div>
        </form>
        {error && <p className="home-error" role="alert">{error}</p>}
      </section>

      <section className="how-section">
        <div className="section-title"><span>NO ART DEGREE REQUIRED</span><h2>Three steps to <em>giggles.</em></h2></div>
        <div className="steps-row">
          <div className="step-card"><span className="step-number">01</span><span className="step-emoji">👋</span><h3>Round up your pals</h3><p>Make a room and send your friends the code. Easy peasy.</p></div>
          <div className="step-connector">〰</div>
          <div className="step-card"><span className="step-number">02</span><span className="step-emoji">🖍️</span><h3>Draw it your way</h3><p>Get a secret word and doodle it before the timer runs out.</p></div>
          <div className="step-connector">〰</div>
          <div className="step-card"><span className="step-number">03</span><span className="step-emoji">🎉</span><h3>Guess & celebrate</h3><p>Shout your guess in the chat. The faster, the more points!</p></div>
        </div>
      </section>

      <section className="feature-strip"><span>✦</span><span>NO DOWNLOADS</span><i>·</i><span>JUST GOOD DOODLES</span><i>·</i><span>100% FRIEND-SAFE</span><span>✦</span></section>
      <footer className="site-footer"><span>Made for people who draw suns as yellow circles ☀️</span><span>© 2026 doodledash</span></footer>

      <AnimatePresence>
        {showCreate && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <motion.form className="modal-card" onSubmit={createRoom} initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.98 }}>
            <button type="button" className="modal-close" onClick={() => setShowCreate(false)} aria-label="Close"><X size={20} /></button>
            <div className="modal-kicker"><Sparkles size={15} /> ROUND UP YOUR CREW</div><h2>Make a doodle den</h2><p className="modal-intro">Make it yours, then invite your favorite people.</p>
            <label className="field-label">ROOM NAME<input value={settings.name} maxLength={30} onChange={(event) => updateSetting("name", event.target.value)} /></label>
            <div className="setting-grid">
              <label className="field-label">MAX PLAYERS<select value={settings.maxPlayers} onChange={(event) => updateSetting("maxPlayers", Number(event.target.value))}>{[2, 4, 6, 8, 10, 12].map((num) => <option key={num} value={num}>{num} players</option>)}</select></label>
              <label className="field-label">ROUNDS<select value={settings.rounds} onChange={(event) => updateSetting("rounds", Number(event.target.value))}>{[3, 5, 7, 10].map((num) => <option key={num} value={num}>{num} rounds</option>)}</select></label>
              <label className="field-label">DRAWING TIME<select value={settings.drawTime} onChange={(event) => updateSetting("drawTime", Number(event.target.value))}>{[30, 60, 90, 120].map((num) => <option key={num} value={num}>{num} seconds</option>)}</select></label>
              <label className="field-label">WORD VIBES<select value={settings.difficulty} onChange={(event) => updateSetting("difficulty", event.target.value)}>{["easy", "medium", "hard", "mixed"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
            </div>
            <label className="field-label custom-words-label">YOUR OWN WORDS <small>(optional, comma separated)</small><input value={settings.customWords} onChange={(event) => updateSetting("customWords", event.target.value)} placeholder="e.g. bestie, spaghetti, Tuesday" /></label>
            <div className="modal-options">
              <label className="toggle-option"><input type="checkbox" checked={settings.hints} onChange={(event) => updateSetting("hints", event.target.checked)} /><span className="fake-check"><Check size={12} /></span> Give guessers little hints</label>
              <label className="toggle-option"><input type="checkbox" checked={settings.isPublic} onChange={(event) => updateSetting("isPublic", event.target.checked)} /><span className="fake-check"><Check size={12} /></span> Make room public</label>
            </div>
            <button className="primary-button modal-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <>CREATE YOUR ROOM <ArrowRight size={18} /></>}</button>
            {error && <p className="home-error" role="alert">{error}</p>}
          </motion.form>
        </motion.div>}
        {matching && <motion.div className="match-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button onClick={() => setMatching(false)} className="match-close" aria-label="Cancel matchmaking"><X /></button><div className="match-orbit"><span>{profile.avatar}</span><i>✦</i><b>?</b></div><h2>Finding your drawing buddies<span>...</span></h2><p>Searching for creative minds</p><div className="match-dots"><i /><i /><i /></div></motion.div>}
      </AnimatePresence>
    </main>
  );
}
