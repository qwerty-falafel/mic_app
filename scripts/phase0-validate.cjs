// Compatibility entry point: one implementation, with failure propagated.
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const result = spawnSync(process.execPath, ['--import', 'tsx', resolve(__dirname, 'phase0-validate.ts'), ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
