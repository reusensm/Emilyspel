import { SlidePuzzle, advanceFromSlidePuzzle } from './engine';

export function renderSlidePuzzle(
  container: HTMLElement,
  imageUrl: string,
  config: SlidePuzzle,
  onComplete: (scene: ReturnType<typeof advanceFromSlidePuzzle>) => void
) {
  const n = config.gridSize;
  const totalTiles = n * n;
  const TILE_SIZE = 80;
  const gridPx = TILE_SIZE * n;

  // Create shuffled tiles (0 = empty, 1..n*n-1 = image tiles)
  const tiles = Array.from({ length: totalTiles }, (_, i) => i);
  // Shuffle by making random valid moves (ensures solvability)
  let emptyIdx = 0;
  for (let i = 0; i < 500; i++) {
    const neighbors = getNeighbors(emptyIdx, n);
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    [tiles[emptyIdx], tiles[pick]] = [tiles[pick], tiles[emptyIdx]];
    emptyIdx = pick;
  }

  function getNeighbors(idx: number, size: number): number[] {
    const row = Math.floor(idx / size);
    const col = idx % size;
    const result: number[] = [];
    if (row > 0) result.push((row - 1) * size + col);
    if (row < size - 1) result.push((row + 1) * size + col);
    if (col > 0) result.push(row * size + (col - 1));
    if (col < size - 1) result.push(row * size + (col + 1));
    return result;
  }

  function isSolved(): boolean {
    return tiles.every((t, i) => t === i);
  }

  let solved = false;

  function render() {
    const grid = container.querySelector('.slide-grid') as HTMLElement;
    grid.innerHTML = '';
    grid.style.width = `${gridPx + (n - 1) * 2}px`;
    grid.style.height = `${gridPx + (n - 1) * 2}px`;
    grid.style.margin = '0 auto 10px';

    tiles.forEach((tile, idx) => {
      const el = document.createElement('div');
      el.className = 'slide-tile' + (tile === 0 ? ' slide-empty' : '');
      el.style.width = `${TILE_SIZE}px`;
      el.style.height = `${TILE_SIZE}px`;

      if (tile !== 0) {
        const srcRow = Math.floor(tile / n);
        const srcCol = tile % n;
        el.style.backgroundImage = `url('${imageUrl}')`;
        el.style.backgroundSize = `${gridPx}px ${gridPx}px`;
        el.style.backgroundPosition = `-${srcCol * TILE_SIZE}px -${srcRow * TILE_SIZE}px`;

        el.addEventListener('click', () => {
          if (solved) return;
          const emptyI = tiles.indexOf(0);
          if (getNeighbors(idx, n).includes(emptyI)) {
            [tiles[idx], tiles[emptyI]] = [tiles[emptyI], tiles[idx]];
            render();
            if (isSolved()) {
              solved = true;
              const msg = container.querySelector('.slide-msg') as HTMLElement;
              msg.textContent = 'Opgelost! 🎉';
              setTimeout(() => {
                onComplete(advanceFromSlidePuzzle());
              }, 1200);
            }
          }
        });
      }
      grid.appendChild(el);
    });
  }

  render();
}
