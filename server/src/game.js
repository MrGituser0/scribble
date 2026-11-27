import { chooseWord } from "./words.js";

const rooms = new Map();
const ROUND_PAUSE_MS = 4500;

const safeName = (value) => String(value || "Doodle pal").trim().slice(0, 20) || "Doodle pal";
const safeAvatar = (value) => String(value || "🦊").slice(0, 12);
const makeCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const normalize = (value) => String(value).trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function publicRoom(room) {
  return {
    code: room.code,
    name: room.name,
    settings: room.settings,
    status: room.status,
    round: room.round,
    totalRounds: room.settings.rounds,
    timeLeft: room.timeLeft,
    artistId: room.artistId,
    hint: room.settings.hints && room.word
      ? room.word.replace(/[^\s-]/g, "_")
      : room.status === "playing" ? "?" : "",
    players: [...room.players.values()].map(({ socketId, ...player }) => ({
      ...player,
      id: socketId,
      isHost: socketId === room.hostId,
      isArtist: socketId === room.artistId,
      hasGuessed: player.hasGuessed
    })),
    messages: room.messages.slice(-50)
  };
}

function broadcastRoom(io, room) {
  const state = publicRoom(room);
  for (const player of room.players.values()) {
    io.to(player.socketId).emit("room:state", {
      ...state,
      word: player.socketId === room.artistId ? room.word : undefined
    });
  }
}

function addMessage(room, message) {
  room.messages.push({ id: `${Date.now()}-${Math.random()}`, ...message });
  if (room.messages.length > 100) room.messages.shift();
}

function stopTimer(room) {
  if (room.timer) clearInterval(room.timer);
  if (room.nextRoundTimer) clearTimeout(room.nextRoundTimer);
  room.timer = null;
  room.nextRoundTimer = null;
}

function finishGame(io, room, Game) {
  stopTimer(room);
  room.status = "finished";
  room.word = null;
  const winner = [...room.players.values()].sort((a, b) => b.score - a.score)[0];
  addMessage(room, { type: "system", text: winner ? `🏆 ${winner.name} is the doodle champion!` : "Game over!" });
  broadcastRoom(io, room);
  if (Game?.db?.readyState === 1) {
    Game.create({
      roomCode: room.code,
      roomName: room.name,
      rounds: room.settings.rounds,
      players: [...room.players.values()].map(({ name, avatar, score }) => ({ name, avatar, score })),
      winner: winner?.name
    }).catch((error) => console.error("Could not save completed game:", error.message));
  }
}

function startTurn(io, room) {
  stopTimer(room);
  const players = [...room.players.values()];
  if (players.length < 2) {
    room.status = "waiting";
    room.word = null;
    broadcastRoom(io, room);
    return;
  }
  if (room.turn >= room.settings.rounds * players.length) {
    finishGame(io, room, Game);
    return;
  }

  room.status = "playing";
  room.round = Math.floor(room.turn / players.length) + 1;
  const artist = players[room.turn % players.length];
  room.artistId = artist.socketId;
  room.word = chooseWord(room.settings.difficulty, room.settings.customWords);
  room.timeLeft = room.settings.drawTime;
  players.forEach((player) => { player.hasGuessed = false; });
  addMessage(room, { type: "system", text: `Round ${room.round}: ${artist.name} is drawing!` });
  broadcastRoom(io, room);

  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.to(room.code).emit("game:timer", room.timeLeft);
    if (room.timeLeft <= 0) {
      stopTimer(room);
      addMessage(room, { type: "system", text: `Time's up! The word was “${room.word}”.` });
      broadcastRoom(io, room);
      room.nextRoundTimer = setTimeout(() => {
        room.turn += 1;
        startTurn(io, room);
      }, ROUND_PAUSE_MS);
    }
  }, 1000);
}

function removePlayer(io, socket, room) {
  if (!room) return;
  const player = room.players.get(socket.id);
  if (!player) return;
  room.players.delete(socket.id);
  socket.leave(room.code);
  if (room.players.size === 0) {
    stopTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  if (room.status === "playing" && room.artistId === socket.id) {
    room.turn += 1;
    startTurn(io, room);
  } else {
    broadcastRoom(io, room);
  }
}

function createRoom(code, socket, profile, options = {}) {
  const settings = {
    maxPlayers: Math.min(12, Math.max(2, Number(options.maxPlayers) || 8)),
    rounds: [3, 5, 7, 10].includes(Number(options.rounds)) ? Number(options.rounds) : 3,
    drawTime: [30, 60, 90, 120].includes(Number(options.drawTime)) ? Number(options.drawTime) : 60,
    difficulty: ["easy", "medium", "hard", "mixed"].includes(options.difficulty) ? options.difficulty : "mixed",
    hints: options.hints !== false,
    isPublic: options.isPublic === true,
    customWords: Array.isArray(options.customWords)
      ? options.customWords.map((word) => String(word).trim().slice(0, 30)).filter(Boolean).slice(0, 50)
      : []
  };
  const room = {
    code,
    name: safeName(options.name || "Doodle den"),
    settings,
    status: "waiting",
    hostId: socket.id,
    artistId: null,
    round: 0,
    turn: 0,
    word: null,
    timeLeft: settings.drawTime,
    players: new Map(),
    messages: [],
    timer: null,
    nextRoundTimer: null
  };
  room.players.set(socket.id, {
    socketId: socket.id,
    name: safeName(profile.name),
    avatar: safeAvatar(profile.avatar),
    score: 0,
    hasGuessed: false
  });
  rooms.set(code, room);
  socket.data.roomCode = code;
  socket.join(code);
  return room;
}

export function registerGameHandlers(io, socket, Game) {
  const reply = (ack, result) => { if (typeof ack === "function") ack(result); };

  socket.on("room:create", ({ profile = {}, settings = {} } = {}, ack) => {
    const current = rooms.get(socket.data.roomCode);
    if (current) removePlayer(io, socket, current);
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = createRoom(code, socket, profile, settings);
    broadcastRoom(io, room);
    reply(ack, { ok: true, code });
  });

  socket.on("room:join", ({ code, profile = {} } = {}, ack) => {
    const roomCode = String(code || "").toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return reply(ack, { ok: false, error: "That room code could not be found." });
    if (room.status !== "waiting") return reply(ack, { ok: false, error: "This game has already started." });
    if (room.players.has(socket.id)) {
      broadcastRoom(io, room);
      return reply(ack, { ok: true, code: room.code });
    }
    if (room.players.size >= room.settings.maxPlayers) return reply(ack, { ok: false, error: "This room is full." });
    const previous = rooms.get(socket.data.roomCode);
    if (previous) removePlayer(io, socket, previous);
    room.players.set(socket.id, {
      socketId: socket.id,
      name: safeName(profile.name),
      avatar: safeAvatar(profile.avatar),
      score: 0,
      hasGuessed: false
    });
    socket.data.roomCode = room.code;
    socket.join(room.code);
    addMessage(room, { type: "system", text: `${safeName(profile.name)} joined the room!` });
    broadcastRoom(io, room);
    reply(ack, { ok: true, code: room.code });
  });

  socket.on("match:quick", ({ profile = {} } = {}, ack) => {
    const existing = [...rooms.values()]
      .find((room) => room.settings.isPublic && room.status === "waiting" && room.players.size < room.settings.maxPlayers);
    if (existing) {
      const previous = rooms.get(socket.data.roomCode);
      if (previous) removePlayer(io, socket, previous);
      existing.players.set(socket.id, {
        socketId: socket.id,
        name: safeName(profile.name),
        avatar: safeAvatar(profile.avatar),
        score: 0,
        hasGuessed: false
      });
      socket.data.roomCode = existing.code;
      socket.join(existing.code);
      addMessage(existing, { type: "system", text: `${safeName(profile.name)} joined the room!` });
      broadcastRoom(io, existing);
      reply(ack, { ok: true, code: existing.code });
      return;
    }
    const room = createRoom(makeCode(), socket, profile, { isPublic: true, name: "Quick doodle match" });
    broadcastRoom(io, room);
    reply(ack, { ok: true, code: room.code });
  });

  socket.on("room:start", (_, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.id !== room.hostId) return reply(ack, { ok: false, error: "Only the host can start the game." });
    if (!["waiting", "finished"].includes(room.status)) return reply(ack, { ok: false, error: "This game is already in progress." });
    if (room.players.size < 2) return reply(ack, { ok: false, error: "Invite at least one more player to start." });
    room.turn = 0;
    room.players.forEach((player) => { player.score = 0; });
    addMessage(room, { type: "system", text: "The game is starting. Grab your drawing hat!" });
    startTurn(io, room);
    reply(ack, { ok: true });
  });

  socket.on("room:leave", () => {
    const room = rooms.get(socket.data.roomCode);
    delete socket.data.roomCode;
    removePlayer(io, socket, room);
  });

  socket.on("room:kick", ({ playerId } = {}, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.id !== room.hostId) return reply(ack, { ok: false, error: "Only the host can remove players." });
    if (room.status !== "waiting") return reply(ack, { ok: false, error: "Players can't be removed after the game starts." });
    const target = io.sockets.sockets.get(playerId);
    if (!target || !room.players.has(playerId)) return reply(ack, { ok: false, error: "That player is no longer in the room." });
    target.emit("room:kicked", { message: "The host removed you from the room." });
    removePlayer(io, target, room);
    delete target.data.roomCode;
    reply(ack, { ok: true });
  });

  socket.on("game:chat", ({ text } = {}, ack) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && room.players.get(socket.id);
    const message = String(text || "").trim().slice(0, 160);
    if (!room || !player || !message) return reply(ack, { ok: false, error: "Enter a message first." });
    if (room.status === "playing" && socket.id !== room.artistId && !player.hasGuessed
      && normalize(message) === normalize(room.word)) {
      player.hasGuessed = true;
      const points = Math.max(50, Math.round(100 + room.timeLeft * 2));
      player.score += points;
      addMessage(room, { type: "correct", text: `${player.name} guessed it!`, playerId: socket.id, points });
      broadcastRoom(io, room);
      if ([...room.players.values()].filter((item) => item.socketId !== room.artistId)
        .every((item) => item.hasGuessed)) {
        stopTimer(room);
        room.nextRoundTimer = setTimeout(() => {
          room.turn += 1;
          startTurn(io, room);
        }, ROUND_PAUSE_MS);
      }
      return reply(ack, { ok: true, correct: true });
    }
    if (room.status === "playing" && socket.id === room.artistId) {
      return reply(ack, { ok: false, error: "Artists can't guess their own word." });
    }
    if (room.status === "playing" && player.hasGuessed) {
      return reply(ack, { ok: false, error: "You already guessed correctly this turn." });
    }
    addMessage(room, {
      type: "chat",
      text: message,
      playerId: socket.id,
      playerName: player.name,
      avatar: player.avatar
    });
    io.to(room.code).emit("chat:message", room.messages[room.messages.length - 1]);
    reply(ack, { ok: true });
  });

  socket.on("draw:start", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.status === "playing" && room.artistId === socket.id) {
      socket.to(room.code).emit("draw:start", payload);
    }
  });
  socket.on("draw:points", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.status === "playing" && room.artistId === socket.id) {
      socket.to(room.code).emit("draw:points", payload);
    }
  });
  socket.on("draw:end", () => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.status === "playing" && room.artistId === socket.id) {
      socket.to(room.code).emit("draw:end");
    }
  });
  socket.on("draw:clear", () => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.status === "playing" && room.artistId === socket.id) {
      socket.to(room.code).emit("draw:clear");
    }
  });
  socket.on("draw:sync", (strokes) => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.status === "playing" && room.artistId === socket.id && Array.isArray(strokes)) {
      socket.to(room.code).emit("draw:sync", strokes.slice(-300));
    }
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    removePlayer(io, socket, room);
  });
}

export function listPublicRooms() {
  return [...rooms.values()]
    .filter((room) => room.settings.isPublic && room.status === "waiting")
    .map((room) => ({ code: room.code, name: room.name, players: room.players.size, maxPlayers: room.settings.maxPlayers }));
}

