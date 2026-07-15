/**
 * Deterministic word-search grid builder, extracted for the platform so
 * analog.js can reuse it without pulling in the browser renderer. Identical
 * logic to renderer.js buildWordSearch (learner grid and answer key match).
 */

function mulberry32(seedStr) {
  let h = 1779033703;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Deterministic greedy placement — identical to renderer.js buildWordSearch so
// the learner grid and this answer key match, and the validator can reproduce it.
export function buildWordSearch(words, gridSize) {
  const size = gridSize ?? 12;
  const rnd = mulberry32(words.join('|') + size);
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placed = [];
  const unplaced = [];
  const dirs = [[0, 1], [1, 0], [1, 1]];
  const fits = (w, row, col, dr, dc) => {
    if (row + dr * (w.length - 1) >= size || col + dc * (w.length - 1) >= size) return false;
    for (let i = 0; i < w.length; i++) {
      const cell = grid[row + dr * i][col + dc * i];
      if (cell && cell !== w[i]) return false;
    }
    return true;
  };
  for (const raw of [...words].sort((x, y) => y.trim().length - x.trim().length)) {
    const w = raw.trim().toUpperCase();
    let done = false;
    for (const [dr, dc] of dirs) {
      for (let row = 0; row < size && !done; row++) {
        for (let col = 0; col < size && !done; col++) {
          if (fits(w, row, col, dr, dc)) {
            for (let i = 0; i < w.length; i++) grid[row + dr * i][col + dc * i] = w[i];
            placed.push({ word: raw, row, col, dr, dc });
            done = true;
          }
        }
      }
      if (done) break;
    }
    if (!done) unplaced.push(raw);
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(rnd() * 26)];
  }
  return { grid, placed, unplaced, size };
}
