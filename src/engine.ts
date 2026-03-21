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

export interface Scene {
  image: string;
  text: string;
  left?: Choice;
  right?: Choice;
  puzzle?: Puzzle;
  multiPuzzle?: MultiPuzzle;
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
  return !scene.left && !scene.right && !scene.puzzle && !scene.multiPuzzle;
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
  if (scene.puzzle.answers.some(a => a.toLowerCase() === normalized)) {
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
