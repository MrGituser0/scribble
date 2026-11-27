const words = {
  easy: ["apple", "sun", "cat", "pizza", "rainbow", "fish", "hat", "moon", "cake", "tree"],
  medium: ["spaceship", "waterfall", "popcorn", "telescope", "jellyfish", "campfire", "carousel", "treasure"],
  hard: ["daydream", "mischief", "gravity", "nostalgia", "imagination", "déjà vu", "début", "serendipity"]
};

export function chooseWord(difficulty, customWords = []) {
  if (customWords.length && Math.random() < 0.4) {
    return customWords[Math.floor(Math.random() * customWords.length)];
  }
  const pool = difficulty === "mixed"
    ? Object.values(words).flat()
    : words[difficulty] || words.easy;
  return pool[Math.floor(Math.random() * pool.length)];
}
