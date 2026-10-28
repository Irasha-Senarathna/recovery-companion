import { createMemoryKeyStore } from './keyStore';

/** Web demo stand-in: memory only, cleared on reload. Not secure. */
export const secureStore = createMemoryKeyStore();
