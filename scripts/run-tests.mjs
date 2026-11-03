import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['--loader', 'ts-node/esm', 'tests/runTests.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Runtime tests use ts-node transpilation; npm run build performs type checking.
      TS_NODE_TRANSPILE_ONLY: 'true',
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'NodeNext', moduleResolution: 'NodeNext' }),
    },
  }
);

if (result.error) {
  console.error('Unable to start the YatraBus test runner:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
