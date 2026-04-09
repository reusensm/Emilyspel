import storyData from './story.json';

export interface Choice {
  label: string;
  next: string;
}

export interface Puzzle {
  answers: string[];
  hint: string;
  next: string;
}

export interface MultiPuzzle {
  answers: string[];
  hints: string[];
  wrongText: string;
  next: string;
  hintAfter: number;
}

export interface Wordle {
  word?: string;
  words?: string[];
  next: string;
  maxGuesses: number;
}

export function getWordleWord(wordle: Wordle): string {
  if (wordle.words && wordle.words.length > 0) {
    return wordle.words[Math.floor(Math.random() * wordle.words.length)];
  }
  return wordle.word || '';
}

export interface SlidePuzzle {
  next: string;
  gridSize: number;
}

export interface WordSearch {
  words: string[];
  next: string;
  gridSize: number;
}

export interface TimelinePhoto {
  image: string;
  date: string;
}

export interface Timeline {
  photos: TimelinePhoto[];
  next: string;
}

export interface Scene {
  image: string;
  text: string;
  left?: Choice;
  right?: Choice;
  puzzle?: Puzzle;
  multiPuzzle?: MultiPuzzle;
  wordle?: Wordle;
  slidePuzzle?: SlidePuzzle;
  wordSearch?: WordSearch;
  timeline?: Timeline;
}

export function isTimeline(scene: Scene): boolean {
  return !!scene.timeline;
}

export function advanceFromTimeline(): Scene {
  const scene = getCurrentScene();
  history.push(currentSceneId);
  currentSceneId = scene.timeline!.next;
  return getCurrentScene();
}

export interface Story {
  startScene: string;
  passwordHint: string;
  scenes: Record<string, Scene>;
}

const story = storyData as Story;

let currentSceneId: string = story.startScene;
const history: string[] = [];

export function getStory(): Story {
  return story;
}

export function getCurrentScene(): Scene {
  return story.scenes[currentSceneId];
}

export function getCurrentSceneId(): string {
  return currentSceneId;
}

export function isEnding(scene: Scene): boolean {
  return !scene.left && !scene.right && !scene.puzzle && !scene.multiPuzzle && !scene.wordle && !scene.slidePuzzle && !scene.wordSearch && !scene.timeline;
}

export function isSlidePuzzle(scene: Scene): boolean {
  return !!scene.slidePuzzle;
}

export function isWordSearch(scene: Scene): boolean {
  return !!scene.wordSearch;
}

export function advanceFromSlidePuzzle(): Scene {
  const scene = getCurrentScene();
  history.push(currentSceneId);
  currentSceneId = scene.slidePuzzle!.next;
  return getCurrentScene();
}

export function advanceFromWordSearch(): Scene {
  const scene = getCurrentScene();
  history.push(currentSceneId);
  currentSceneId = scene.wordSearch!.next;
  return getCurrentScene();
}

export function isWordle(scene: Scene): boolean {
  return !!scene.wordle;
}

export type LetterResult = 'correct' | 'present' | 'absent';

export function checkWordleGuess(guess: string, target: string): LetterResult[] {
  const g = guess.toLowerCase().split('');
  const t = target.toLowerCase().split('');
  const result: LetterResult[] = Array(t.length).fill('absent');
  const remaining = [...t];

  // First pass: correct positions
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
      remaining[i] = '';
    }
  }
  // Second pass: present but wrong position
  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'correct') continue;
    const idx = remaining.indexOf(g[i]);
    if (idx >= 0) {
      result[i] = 'present';
      remaining[idx] = '';
    }
  }
  return result;
}

export function advanceFromWordle(): Scene {
  const scene = getCurrentScene();
  history.push(currentSceneId);
  currentSceneId = scene.wordle!.next;
  return getCurrentScene();
}

export function isPuzzle(scene: Scene): boolean {
  return !!scene.puzzle;
}

export function isMultiPuzzle(scene: Scene): boolean {
  return !!scene.multiPuzzle;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(input: string, target: string): boolean {
  return levenshtein(input.trim().toLowerCase(), target.toLowerCase()) <= 2;
}

export function advanceFromMultiPuzzle(): Scene {
  const scene = getCurrentScene();
  history.push(currentSceneId);
  currentSceneId = scene.multiPuzzle!.next;
  return getCurrentScene();
}

export function solvePuzzle(answer: string): Scene | null {
  const scene = getCurrentScene();
  if (!scene.puzzle) return null;

  const normalized = answer.trim().toLowerCase();
  if (scene.puzzle.answers.some(a => levenshtein(normalized, a.toLowerCase()) <= 1)) {
    history.push(currentSceneId);
    currentSceneId = scene.puzzle.next;
    return getCurrentScene();
  }
  return null;
}

export function choose(direction: 'left' | 'right'): Scene | null {
  const scene = getCurrentScene();
  const choice = scene[direction];
  if (!choice) return null;

  history.push(currentSceneId);
  currentSceneId = choice.next;
  return getCurrentScene();
}

export function restart(): void {
  currentSceneId = story.startScene;
  history.length = 0;
}

export function getSceneCount(): number {
  return Object.keys(story.scenes).length;
}

export function getProgress(): number {
  return history.length;
}
