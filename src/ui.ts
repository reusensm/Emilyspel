import { Scene, isEnding, isPuzzle, isMultiPuzzle, choose, solvePuzzle, fuzzyMatch, advanceFromMultiPuzzle, restart, getCurrentScene, getProgress, getSceneCount } from './engine';
import { setupSwipe } from './swipe';
import { decryptImage } from './crypto';

let password: string = '';
let cleanupSwipe: (() => void) | null = null;
const imageCache = new Map<string, string>();

export function setPassword(pw: string) {
  password = pw;
}

async function loadImage(filename: string): Promise<string> {
  if (imageCache.has(filename)) {
    return imageCache.get(filename)!;
  }

  try {
    const response = await fetch(`./images/${filename}`);
    const data = await response.arrayBuffer();
    const url = await decryptImage(data, password);
    imageCache.set(filename, url);
    return url;
  } catch {
    return '';
  }
}

function updateProgress() {
  let bar = document.querySelector('.progress-bar') as HTMLElement;
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'progress-bar';
    document.body.appendChild(bar);
  }
  const pct = Math.min((getProgress() / (getSceneCount() - 1)) * 100, 100);
  bar.style.width = `${pct}%`;
}

export async function renderScene(scene: Scene) {
  const app = document.getElementById('app')!;
  const ending = isEnding(scene);
  const puzzle = isPuzzle(scene);
  const multi = isMultiPuzzle(scene);

  // Clean up previous swipe
  if (cleanupSwipe) {
    cleanupSwipe();
    cleanupSwipe = null;
  }

  // Load image
  const imageUrl = await loadImage(scene.image);

  const cardClass = ending ? 'ending-card' : (puzzle || multi) ? 'puzzle-card' : '';

  let contentHtml = '';
  if (multi) {
    const mp = scene.multiPuzzle!;
    const blanks = mp.answers.map((_, i) => `<span class="multi-slot" data-idx="${i}">???</span>`).join(' ');
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="multi-slots">${blanks}</div>
      <div class="puzzle-input-wrap">
        <input type="text" class="puzzle-input" placeholder="Raad een plaats..." autocomplete="off" />
        <p class="puzzle-error"></p>
      </div>
      <p class="multi-progress">0 / ${mp.answers.length}</p>
    `;
  } else if (puzzle) {
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="puzzle-input-wrap">
        <input type="text" class="puzzle-input" placeholder="Typ je antwoord..." autocomplete="off" />
        <p class="puzzle-error"></p>
      </div>
    `;
  } else if (ending) {
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <button class="restart-btn">Play Again</button>
    `;
  } else {
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="choice-labels">
        <div class="choice-label left">${scene.left!.label}</div>
        <div class="choice-label right">${scene.right!.label}</div>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="game-container">
      <div class="card card-enter ${cardClass}">
        <div class="card-bg" ${imageUrl ? `style="background-image: url('${imageUrl}')"` : ''}></div>
        <div class="card-overlay"></div>
        ${!ending && !puzzle && !multi ? `
          <div class="swipe-indicator left-indicator">&#x2190;</div>
          <div class="swipe-indicator right-indicator">&#x2192;</div>
        ` : ''}
        <div class="card-content">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;

  updateProgress();

  if (ending) {
    app.querySelector('.restart-btn')!.addEventListener('click', () => {
      restart();
      renderScene(getCurrentScene());
    });
    return;
  }

  if (puzzle) {
    const input = app.querySelector('.puzzle-input') as HTMLInputElement;
    const error = app.querySelector('.puzzle-error') as HTMLElement;
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const next = solvePuzzle(input.value);
      if (next) {
        renderScene(next);
      } else {
        error.textContent = scene.puzzle!.hint;
        input.value = '';
        const card = app.querySelector('.card') as HTMLElement;
        card.classList.remove('card-enter');
        card.classList.add('puzzle-shake');
        setTimeout(() => card.classList.remove('puzzle-shake'), 500);
      }
    });
    return;
  }

  if (multi) {
    const mp = scene.multiPuzzle!;
    const input = app.querySelector('.puzzle-input') as HTMLInputElement;
    const error = app.querySelector('.puzzle-error') as HTMLElement;
    const progressText = app.querySelector('.multi-progress') as HTMLElement;
    const slots = app.querySelectorAll('.multi-slot');
    const found = new Set<number>();
    let wrongCount = 0;

    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const guess = input.value.trim();
      if (!guess) return;

      // Check against all unfound answers
      let matchIdx = -1;
      for (let i = 0; i < mp.answers.length; i++) {
        if (!found.has(i) && fuzzyMatch(guess, mp.answers[i])) {
          matchIdx = i;
          break;
        }
      }

      if (matchIdx >= 0) {
        found.add(matchIdx);
        slots[matchIdx].textContent = mp.answers[matchIdx];
        slots[matchIdx].classList.add('found');
        progressText.textContent = `${found.size} / ${mp.answers.length}`;
        error.textContent = '';
        input.value = '';

        if (found.size === mp.answers.length) {
          // All found — advance
          setTimeout(() => {
            const next = advanceFromMultiPuzzle();
            renderScene(next);
          }, 800);
          input.disabled = true;
          progressText.textContent = 'Allemaal gevonden! 🎉';
          return;
        }
      } else {
        wrongCount++;
        error.textContent = mp.wrongText;
        input.value = '';

        // Give a hint every hintAfter wrong guesses
        if (wrongCount % mp.hintAfter === 0) {
          const remaining = mp.answers.filter((_, i) => !found.has(i));
          const hintIdx = mp.answers.indexOf(remaining[Math.floor(Math.random() * remaining.length)]);
          const hint = mp.hints[hintIdx] || `Denk aan ${mp.answers[hintIdx].charAt(0)}...`;
          setTimeout(() => {
            error.textContent = `Tipje: ${hint}`;
          }, 1500);
        }

        const card = app.querySelector('.card') as HTMLElement;
        card.classList.remove('puzzle-shake');
        void card.offsetWidth;
        card.classList.add('puzzle-shake');
        setTimeout(() => card.classList.remove('puzzle-shake'), 500);
      }
    });
    return;
  }

  // Set up swipe
  const card = app.querySelector('.card') as HTMLElement;
  const leftIndicator = app.querySelector('.left-indicator') as HTMLElement;
  const rightIndicator = app.querySelector('.right-indicator') as HTMLElement;
  const leftLabel = app.querySelector('.choice-label.left') as HTMLElement;
  const rightLabel = app.querySelector('.choice-label.right') as HTMLElement;

  cleanupSwipe = setupSwipe(
    card,
    (direction) => {
      const next = choose(direction);
      if (next) renderScene(next);
    },
    (offsetX, progress) => {
      // Update indicators based on drag
      if (offsetX < 0) {
        leftIndicator.style.opacity = String(progress);
        rightIndicator.style.opacity = '0';
        leftLabel.classList.toggle('active', progress > 0.5);
        rightLabel.classList.remove('active');
      } else if (offsetX > 0) {
        rightIndicator.style.opacity = String(progress);
        leftIndicator.style.opacity = '0';
        rightLabel.classList.toggle('active', progress > 0.5);
        leftLabel.classList.remove('active');
      } else {
        leftIndicator.style.opacity = '0';
        rightIndicator.style.opacity = '0';
        leftLabel.classList.remove('active');
        rightLabel.classList.remove('active');
      }
    }
  );
}
