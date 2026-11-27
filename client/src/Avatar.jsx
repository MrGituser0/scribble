import { motion } from "framer-motion";
import { avatars } from "./store.js";

export function AvatarPicker({ value, onChange }) {
  return (
    <div className="avatar-grid" role="group" aria-label="Choose your avatar">
      {avatars.map((avatar, index) => (
        <motion.button
          key={avatar}
          type="button"
          className={`avatar-option ${value === avatar ? "selected" : ""}`}
          onClick={() => onChange(avatar)}
          whileHover={{ scale: 1.12, rotate: index % 2 ? 8 : -8 }}
          whileTap={{ scale: 0.9 }}
          aria-label={`Choose ${avatar} avatar`}
          aria-pressed={value === avatar}
        >
          {avatar}
        </motion.button>
      ))}
    </div>
  );
}

export function Avatar({ children, className = "" }) {
  return <span className={`avatar-face ${className}`}>{children || "🦊"}</span>;
}
