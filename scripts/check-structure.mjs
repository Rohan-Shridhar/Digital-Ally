import { existsSync } from 'node:fs';

const requiredPaths = [
  'src/main.tsx',
  'src/app/App.tsx',
  'src/app/styles.css',
  'src/app/context/AppContext.tsx',
  'src/components/IconSet.tsx',
  'src/features/generation/geminiService.ts',
  'src/shared/constants.ts',
  'src/shared/privacy.ts',
  'src/shared/types.ts',
];

const removedPaths = [
  'index.tsx',
  'index.css',
  'src/App.tsx',
  'src/context/AppContext.tsx',
  'src/constants.ts',
  'src/privacy.ts',
  'src/types.ts',
  'src/services/geminiService.ts',
];

const missing = requiredPaths.filter(
  (filePath) => !existsSync(new URL(`../${filePath}`, import.meta.url))
);
const stillPresent = removedPaths.filter((filePath) =>
  existsSync(new URL(`../${filePath}`, import.meta.url))
);

if (missing.length || stillPresent.length) {
  if (missing.length) {
    console.error(`Missing expected structure files: ${missing.join(', ')}`);
  }

  if (stillPresent.length) {
    console.error(`Old locations should be removed: ${stillPresent.join(', ')}`);
  }

  process.exit(1);
}

console.log('Project structure check passed.');
