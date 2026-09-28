/** Loads the workspace root `.env` before any test module reads `process.env`. */
import { loadRootEnv } from '@tula/config';

loadRootEnv();
