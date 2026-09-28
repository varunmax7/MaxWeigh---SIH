/** Loads the workspace root `.env` before any test that needs `DATABASE_URL` runs. */
import { loadRootEnv } from '@tula/config';

loadRootEnv();
