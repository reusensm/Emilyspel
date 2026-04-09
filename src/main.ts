import './style.css';
import { getStory, getCurrentScene } from './engine';
import { testDecrypt } from './crypto';
import { renderScene, setPassword } from './ui';

const story = getStory();

function renderPasswordScreen() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="password-screen">
      <h1>Dag poepie liefje</h1>
      <p class="hint">Vandaag kan je 2 van je top-skills toepassen in de hoop je cadeautje te verdienen: swipen en puzzelen.</p>
      <p class="hint">${story.passwordHint}</p>
      <input type="text" id="password-input" placeholder="Wachtwoord..." autocomplete="off" />
      <p class="error" id="error-msg"></p>
    </div>
  `;

  const input = document.getElementById('password-input') as HTMLInputElement;
  const errorMsg = document.getElementById('error-msg')!;
  const screen = app.querySelector('.password-screen')!;

  input.focus();

  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const pw = input.value.trim();
    if (!pw) return;

    input.disabled = true;
    errorMsg.textContent = '';

    // Try to decrypt the first scene's image as a test
    const firstScene = story.scenes[story.startScene];
    try {
      const response = await fetch(`./images/${firstScene.image}`);
      if (!response.ok) {
        // No encrypted images yet - accept any password (dev mode)
        setPassword(pw);
        renderScene(getCurrentScene());
        return;
      }
      const data = await response.arrayBuffer();
      const success = await testDecrypt(data, pw);

      if (success) {
        setPassword(pw);
        renderScene(getCurrentScene());
      } else {
        errorMsg.textContent = 'That\'s not quite right... Try again!';
        screen.classList.add('shake');
        setTimeout(() => screen.classList.remove('shake'), 500);
        input.disabled = false;
        input.focus();
        input.select();
      }
    } catch {
      // If fetch fails, just accept the password (offline/dev mode)
      setPassword(pw);
      renderScene(getCurrentScene());
    }
  });
}

renderPasswordScreen();
