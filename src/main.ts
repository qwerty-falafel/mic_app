import { loadConfig } from './config.js';
import { startMic } from './server.js';

const mic = await startMic(loadConfig());
const stop = () => void mic.stop().finally(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
