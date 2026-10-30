import { Directory, Paths } from 'expo-file-system';

/**
 * Cache folders where unencrypted media can briefly exist: expo-audio
 * recordings ("Audio"), our playback copies ("rc-voice") and the image
 * picker's re-encoded photos ("ImagePicker"). Each file is deleted right after
 * use; this sweep catches anything left by a crash or a lock mid-recording.
 * It runs at every launch and in delete-all.
 */
export const MEDIA_TEMP_DIRS = ['Audio', 'rc-voice', 'ImagePicker'] as const;

export async function clearMediaTemp(): Promise<void> {
  for (const name of MEDIA_TEMP_DIRS) {
    const dir = new Directory(Paths.cache, name);
    if (dir.exists) dir.delete();
  }
}
