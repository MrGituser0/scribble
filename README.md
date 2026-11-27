# Doodle Dash

A real-time multiplayer drawing and guessing game built with React, Vite, Express, Socket.IO, and optional MongoDB persistence.

## Run locally

1. Install Node.js 20 or newer.
2. From the project root, run `npm install`.
3. Start both apps with `npm run dev`.
4. Open `http://localhost:5173` in two or more browser tabs to try a multiplayer game.

The Socket.IO/REST server listens on port `3001`; Vite proxies `/api` requests to it. MongoDB is optional for local play. Set `MONGODB_URI` in the environment to save completed game results. Set `CLIENT_URL` if the frontend is hosted at a different origin, and `VITE_SERVER_URL` in the client environment when the API/socket server is not at `http://localhost:3001`.

## Included gameplay

- Guest names and a persistent selection of 24 cartoon avatars.
- Private/public rooms, room codes, room settings, custom words, and quick matchmaking.
- Host-controlled lobbies, shareable invitations, player removal, and leave controls.
- Rotating artist turns, configurable timers/rounds, live canvas strokes, color/brush tools, undo/redo, and synchronized clearing.
- Live chat, automatic correct-guess detection, hint display, scoring, and a leaderboard.
- Responsive layouts for desktop and mobile, plus accessible labels and reduced-motion support.

Rooms and active game state are held in memory; completed results are stored in MongoDB when configured. For multi-instance production deployments, move room state to a shared Socket.IO adapter/store and configure origin/rate-limit policies for the deployment.
