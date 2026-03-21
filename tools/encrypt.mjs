import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { webcrypto } from 'crypto';

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 100000;

const rawDir = join(process.cwd(), 'raw-images');
const outDir = join(process.cwd(), 'public', 'images');

if (!existsSync(rawDir)) {
  console.error('Error: raw-images/ directory not found.');
  console.error('Place your photos in raw-images/ and run this script again.');
  process.exit(1);
}

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run encrypt <password>');
  console.error('Example: npm run encrypt "mysecretword"');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
}

async function encryptFile(inputPath, outputPath, password) {
  const data = readFileSync(inputPath);
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const encrypted = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Format: salt (16 bytes) + iv (12 bytes) + ciphertext
  const output = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  output.set(salt, 0);
  output.set(iv, SALT_LENGTH);
  output.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

  writeFileSync(outputPath, output);
}

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const files = readdirSync(rawDir).filter(f =>
  imageExtensions.some(ext => f.toLowerCase().endsWith(ext))
);

if (files.length === 0) {
  console.error('No image files found in raw-images/');
  process.exit(1);
}

console.log(`Encrypting ${files.length} image(s)...`);

for (const file of files) {
  const inputPath = join(rawDir, file);
  const baseName = file.replace(/\.[^.]+$/, '');
  const outputPath = join(outDir, `${baseName}.enc`);

  await encryptFile(inputPath, outputPath, password);
  console.log(`  ${file} -> ${baseName}.enc`);
}

console.log('Done! Encrypted images are in public/images/');
