import { WordSearch, advanceFromWordSearch } from './engine';

interface Placement {
  word: string;
  cells: [number, number][];
}

const DIRECTIONS: [number, number][] = [
  [0, 1], [0, -1],   // horizontal
  [1, 0], [-1, 0],   // vertical
  [1, 1], [-1, -1],  // diagonal
  [1, -1], [-1, 1],  // anti-diagonal
];

function generateGrid(words: string[], size: number): { grid: string[][], placements: Placement[] } {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placements: Placement[] = [];

  // Sort words longest first for better placement
  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    const upper = word.toUpperCase().replace(/\s/g, '');
    let placed = false;

    // Try random positions and directions
    const attempts = 200;
    for (let a = 0; a < attempts && !placed; a++) {
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);

      const cells: [number, number][] = [];
      let fits = true;

      for (let i = 0; i < upper.length; i++) {
        const r = row + dir[0] * i;
        const c = col + dir[1] * i;
        if (r < 0 || r >= size || c < 0 || c >= size) { fits = false; break; }
        if (grid[r][c] !== '' && grid[r][c] !== upper[i]) { fits = false; break; }
        cells.push([r, c]);
      }

      if (fits) {
        for (let i = 0; i < upper.length; i++) {
          grid[cells[i][0]][cells[i][1]] = upper[i];
        }
        placements.push({ word, cells });
        placed = true;
      }
    }

    if (!placed) {
      console.warn(`Could not place word: ${word}`);
    }
  }

  // Fill remaining cells with random letters
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }

  return { grid, placements };
}

export function renderWordSearch(
  container: HTMLElement,
  config: WordSearch,
  onComplete: (scene: ReturnType<typeof advanceFromWordSearch>) => void
) {
  const { grid, placements } = generateGrid(config.words, config.gridSize);
  const found = new Set<string>();

  // Selection state
  let selecting = false;
  let startCell: [number, number] | null = null;
  let currentCell: [number, number] | null = null;

  const gridEl = container.querySelector('.ws-grid') as HTMLElement;
  const wordList = container.querySelector('.ws-words') as HTMLElement;
  const msg = container.querySelector('.ws-msg') as HTMLElement;

  // Render word list
  wordList.innerHTML = config.words.map(w =>
    `<span class="ws-word" data-word="${w}">${w}</span>`
  ).join(' ');

  // Render grid
  const n = config.gridSize;
  gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  gridEl.innerHTML = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = document.createElement('div');
      cell.className = 'ws-cell';
      cell.textContent = grid[r][c];
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      gridEl.appendChild(cell);
    }
  }

  function getCellsInLine(r1: number, c1: number, r2: number, c2: number): [number, number][] {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
    // Only allow straight lines (horizontal, vertical, diagonal)
    if (r1 !== r2 && c1 !== c2 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return [];
    const cells: [number, number][] = [];
    for (let i = 0; i < len; i++) {
      cells.push([r1 + dr * i, c1 + dc * i]);
    }
    return cells;
  }

  function highlightSelection() {
    // Clear previous selection highlights
    gridEl.querySelectorAll('.ws-cell').forEach(el => el.classList.remove('ws-selecting'));
    if (!startCell || !currentCell) return;
    const cells = getCellsInLine(startCell[0], startCell[1], currentCell[0], currentCell[1]);
    cells.forEach(([r, c]) => {
      const el = gridEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      if (el) el.classList.add('ws-selecting');
    });
  }

  function checkSelection() {
    if (!startCell || !currentCell) return;
    const selectedCells = getCellsInLine(startCell[0], startCell[1], currentCell[0], currentCell[1]);
    const selectedWord = selectedCells.map(([r, c]) => grid[r][c]).join('');

    for (const p of placements) {
      if (found.has(p.word)) continue;
      const placedWord = p.cells.map(([r, c]) => grid[r][c]).join('');
      if (selectedWord === placedWord) {
        found.add(p.word);
        // Highlight found cells permanently
        p.cells.forEach(([r, c]) => {
          const el = gridEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
          if (el) el.classList.add('ws-found');
        });
        // Strike through word in list
        const wordEl = wordList.querySelector(`[data-word="${p.word}"]`);
        if (wordEl) wordEl.classList.add('ws-struck');

        msg.textContent = `${found.size} / ${placements.length} gevonden`;

        if (found.size === placements.length) {
          msg.textContent = 'Allemaal gevonden! 🎉';
          setTimeout(() => onComplete(advanceFromWordSearch()), 1200);
        }
        return;
      }
    }
  }

  function getCellFromEvent(e: MouseEvent | Touch): [number, number] | null {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || !('dataset' in target)) return null;
    const el = target as HTMLElement;
    if (el.dataset.row === undefined) return null;
    return [Number(el.dataset.row), Number(el.dataset.col)];
  }

  // Mouse events
  gridEl.addEventListener('mousedown', (e) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    selecting = true;
    startCell = cell;
    currentCell = cell;
    highlightSelection();
  });

  document.addEventListener('mousemove', (e) => {
    if (!selecting) return;
    const cell = getCellFromEvent(e);
    if (cell) {
      currentCell = cell;
      highlightSelection();
    }
  });

  document.addEventListener('mouseup', () => {
    if (selecting) {
      checkSelection();
      selecting = false;
      startCell = null;
      currentCell = null;
      gridEl.querySelectorAll('.ws-cell').forEach(el => el.classList.remove('ws-selecting'));
    }
  });

  // Touch events
  gridEl.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const cell = getCellFromEvent(touch);
    if (!cell) return;
    selecting = true;
    startCell = cell;
    currentCell = cell;
    highlightSelection();
  }, { passive: true });

  gridEl.addEventListener('touchmove', (e) => {
    if (!selecting) return;
    e.preventDefault();
    const touch = e.touches[0];
    const cell = getCellFromEvent(touch);
    if (cell) {
      currentCell = cell;
      highlightSelection();
    }
  }, { passive: false });

  gridEl.addEventListener('touchend', () => {
    if (selecting) {
      checkSelection();
      selecting = false;
      startCell = null;
      currentCell = null;
      gridEl.querySelectorAll('.ws-cell').forEach(el => el.classList.remove('ws-selecting'));
    }
  });
}
