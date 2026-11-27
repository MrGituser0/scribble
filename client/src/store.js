import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const avatars = [
  "🦊", "🐸", "🐻", "🐼", "🐵", "🦄", "🐙", "🐧", "🐨", "🐯",
  "🐰", "🦖", "🐳", "🦉", "🐱", "🤖", "👾", "🐲", "🦋", "🐥",
  "🦝", "🐹", "🦁", "🐢"
];

const guestName = () => `Doodle${Math.floor(100 + Math.random() * 900)}`;

export const usePlayer = create(persist(
  (set) => ({
    profile: { name: guestName(), avatar: "🦊" },
    updateProfile: (profile) => set({ profile })
  }),
  {
    name: "doodle-dash-player",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ profile: state.profile })
  }
));
