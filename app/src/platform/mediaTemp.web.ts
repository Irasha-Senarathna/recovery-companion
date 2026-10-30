/** Web demo stand-in: nothing is written to disk. */
export const MEDIA_TEMP_DIRS = [] as const;

export async function clearMediaTemp(): Promise<void> {}
