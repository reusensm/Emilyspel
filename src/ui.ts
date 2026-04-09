import { Scene, isEnding, isPuzzle, isMultiPuzzle, isWordle, isSlidePuzzle, isWordSearch, isTimeline, choose, solvePuzzle, fuzzyMatch, advanceFromMultiPuzzle, checkWordleGuess, advanceFromWordle, getWordleWord, advanceFromTimeline, restart, getCurrentScene, getProgress, getSceneCount } from './engine';
import { setupSwipe } from './swipe';
import { decryptImage } from './crypto';
import { renderSlidePuzzle } from './slidepuzzle';
import { renderWordSearch } from './wordsearch';
import { renderTimeline, setTimelinePassword } from './timeline';

let password: string = '';
let cleanupSwipe: (() => void) | null = null;
const imageCache = new Map<string, string>();

export function setPassword(pw: string) {
  password = pw;
  setTimelinePassword(pw);
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
  const wordle = isWordle(scene);
  const slide = isSlidePuzzle(scene);
  const wordSearch = isWordSearch(scene);
  const timeline = isTimeline(scene);

  // Clean up previous swipe
  if (cleanupSwipe) {
    cleanupSwipe();
    cleanupSwipe = null;
  }

  // Load image
  const imageUrl = await loadImage(scene.image);

  const isSpecial = puzzle || multi || wordle || slide || wordSearch || timeline;
  const cardClass = ending ? 'ending-card' : slide ? 'puzzle-card slide-card' : timeline ? 'puzzle-card timeline-card' : isSpecial ? 'puzzle-card' : '';

  let contentHtml = '';
  let chosenWord = '';
  if (timeline) {
    contentHtml = `
      <div class="card-text" style="font-size:0.95rem;margin-bottom:8px;">${scene.text}</div>
      <div class="timeline-container"></div>
    `;
  } else if (slide) {
    const sp = scene.slidePuzzle!;
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="slide-grid" style="display:grid; grid-template-columns:repeat(${sp.gridSize},1fr); gap:2px; margin-bottom:10px;"></div>
      <p class="slide-msg" style="text-align:center;font-weight:700;color:white;min-height:1.2em;"></p>
    `;
  } else if (wordSearch) {
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="ws-grid"></div>
      <div class="ws-words"></div>
      <p class="ws-msg">0 / ${scene.wordSearch!.words.length} gevonden</p>
    `;
  } else if (wordle) {
    const w = scene.wordle!;
    chosenWord = getWordleWord(w);
    const rows = Array.from({ length: w.maxGuesses }, (_, r) =>
      `<div class="wordle-row" data-row="${r}">${
        Array.from({ length: chosenWord.length }, () => `<div class="wordle-cell"></div>`).join('')
      }</div>`
    ).join('');
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="wordle-grid">${rows}</div>
      <div class="puzzle-input-wrap">
        <input type="text" class="puzzle-input wordle-input" placeholder="Raad het woord (${chosenWord.length} letters)..." maxlength="${chosenWord.length}" autocomplete="off" />
        <p class="puzzle-error"></p>
      </div>
    `;
  } else if (multi) {
    const mp = scene.multiPuzzle!;
    const blanks = mp.answers.map((_, i) => `<span class="multi-slot" data-idx="${i}">???</span>`).join(' ');
    contentHtml = `
      <div class="card-text">${scene.text}</div>
      <div class="multi-slots">${blanks}</div>
      <div class="puzzle-input-wrap">
        <input type="text" class="puzzle-input" placeholder="Raad een plaats..." autocomplete="off" />
        <p class="puzzle-error"></p>
        <p class="multi-hint"></p>
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
        <div class="card-bg" ${imageUrl && !slide ? `style="background-image: url('${imageUrl}')"` : ''}></div>
        <div class="card-overlay" ${slide ? 'style="background: rgba(0,0,0,0.85)"' : ''}></div>
        ${!ending && !isSpecial ? `
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

  if (slide) {
    const cardContent = app.querySelector('.card-content') as HTMLElement;
    renderSlidePuzzle(cardContent, imageUrl, scene.slidePuzzle!, (next) => renderScene(next));
    return;
  }

  if (wordSearch) {
    const cardContent = app.querySelector('.card-content') as HTMLElement;
    renderWordSearch(cardContent, scene.wordSearch!, (next) => renderScene(next));
    return;
  }

  if (timeline) {
    const tlContainer = app.querySelector('.timeline-container') as HTMLElement;
    await renderTimeline(tlContainer, scene.timeline!, imageCache, () => {
      renderScene(advanceFromTimeline());
    });
    return;
  }

  if (wordle) {
    const theWord = chosenWord;
    const input = app.querySelector('.wordle-input') as HTMLInputElement;
    const error = app.querySelector('.puzzle-error') as HTMLElement;
    let currentRow = 0;

    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const guess = input.value.trim().toLowerCase();
      if (guess.length !== theWord.length) {
        error.textContent = `Het woord moet ${theWord.length} letters zijn!`;
        return;
      }

      const results = checkWordleGuess(guess, theWord);
      const row = app.querySelector(`.wordle-row[data-row="${currentRow}"]`)!;
      const cells = row.querySelectorAll('.wordle-cell');

      cells.forEach((cell, i) => {
        const el = cell as HTMLElement;
        el.textContent = guess[i].toUpperCase();
        el.classList.add(`wordle-${results[i]}`);
        el.style.animationDelay = `${i * 0.1}s`;
        el.classList.add('wordle-flip');
      });

      input.value = '';
      currentRow++;

      if (guess === theWord.toLowerCase()) {
        error.textContent = 'Gewonnen! 🎉';
        input.disabled = true;
        setTimeout(() => {
          const next = advanceFromWordle();
          renderScene(next);
        }, 1200);
        return;
      }

      if (currentRow >= scene.wordle!.maxGuesses) {
        error.textContent = `Het was "${theWord}"! Probeer opnieuw...`;
        input.disabled = true;
        setTimeout(() => {
          renderScene(scene);
        }, 2000);
        return;
      }

      error.textContent = '';
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
          const hintEl = app.querySelector('.multi-hint') as HTMLElement;
          const remaining = mp.answers.filter((_, i) => !found.has(i));
          const hintIdx = mp.answers.indexOf(remaining[Math.floor(Math.random() * remaining.length)]);
          const hint = mp.hints[hintIdx] || `Denk aan ${mp.answers[hintIdx].charAt(0)}...`;
          hintEl.textContent = `Tipje: ${hint}`;
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
