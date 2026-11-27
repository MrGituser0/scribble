import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, index: true },
  roomName: { type: String, required: true },
  rounds: { type: Number, required: true },
  players: [{
    name: String,
    avatar: String,
    score: Number
  }],
  winner: String,
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Game", gameSchema);
