import { Timeline } from './engine';

let password = '';
export function setTimelinePassword(pw: string) { password = pw; }

export async function renderTimeline(
  container: HTMLElement,
  timeline: Timeline,
  imageCache: Map<string, string>,
  onDone: () => void
) {
  if (!container) { console.error('timeline: container not found'); return; }
  const photos = timeline.photos;
  const n = photos.length;
  console.log('renderTimeline: loading', n, 'photos');

  // Build a derangement: no photo starts on its correct slot
  let order: number[];
  do {
    order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.some((v, i) => v === i));

  // Load all images first
  const urls: string[] = await Promise.all(photos.map(async (p) => {
    if (imageCache.has(p.image)) return imageCache.get(p.image)!;
    try {
      const res = await fetch(`./images/${p.image}`);
      const buf = await res.arrayBuffer();
      const { decryptImage: dec } = await import('./crypto');
      const url = await dec(buf, password);
      imageCache.set(p.image, url);
      return url;
    } catch { return ''; }
  }));

  // current[slot] = index into photos[] currently occupying that slot
  const current = [...order];
  let selected: number | null = null; // slot index

  function isCorrect(slot: number) {
    return current[slot] === slot;
  }

  function allCorrect() {
    return current.every((val, idx) => val === idx);
  }

  function render() {
    container.innerHTML = `
      <div class="timeline-grid">
        ${current.map((photoIdx, slot) => {
          const photo = photos[photoIdx];
          const url = urls[photoIdx];
          const correct = isCorrect(slot);
          const sel = selected === slot;
          return `
            <div class="timeline-slot ${correct ? 'tl-correct' : ''} ${sel ? 'tl-selected' : ''}" data-slot="${slot}">
              <div class="timeline-img" style="${url ? `background-image:url('${url}')` : ''}"></div>
              <div class="timeline-date">${correct ? photo.date : ''}</div>
              <div class="timeline-num">${slot + 1}</div>
            </div>
          `;
        }).join('')}
      </div>
      <p class="timeline-hint">Tik een foto aan om te selecteren, tik een andere om te wisselen.</p>
      <p class="timeline-progress">${current.filter((v, i) => v === i).length} / ${n} correct</p>
    `;

    container.querySelectorAll('.timeline-slot').forEach(el => {
      el.addEventListener('click', () => {
        const slot = parseInt((el as HTMLElement).dataset.slot!);
        if (isCorrect(slot)) return; // locked in, can't move

        if (selected === null) {
          selected = slot;
          render();
        } else if (selected === slot) {
          selected = null;
          render();
        } else {
          // Swap
          [current[selected], current[slot]] = [current[slot], current[selected]];
          selected = null;
          render();

          if (allCorrect()) {
            const hint = container.querySelector('.timeline-hint') as HTMLElement;
            if (hint) hint.textContent = '🎉 Juiste volgorde!';
            setTimeout(onDone, 1200);
          }
        }
      });
    });
  }

  render();
}
