import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['--loader', 'ts-node/esm', 'tests/runTests.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      // The production build runs the full TypeScript type-check separately.
      // ts-node's ESM loader cannot reliably type-check this project's bundler
      // moduleResolution setting; transpile-only keeps runtime tests executable.
      TS_NODE_TRANSPILE_ONLY: 'true',\n      TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'NodeNext', moduleResolution: 'NodeNext' }),
    },
  }
);

if (result.error) {
  console.error('Unable to start the YatraBus test runner:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
