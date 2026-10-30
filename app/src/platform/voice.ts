import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

export const VOICE_SUPPORTED = true;

export type RecordedVoice = { bytes: Uint8Array; mime: string; durationMs: number };
export type VoiceRecorder = {
  recording: boolean;
  start: () => Promise<'started' | 'denied'>;
  stop: () => Promise<RecordedVoice | null>;
  /** Stops without saving and deletes the file (e.g. the screen closes). */
  cancel: () => Promise<void>;
};

const MAX_SECONDS = 60;
// The LOW_QUALITY preset records 3GP/AMR on Android and AAC (m4a) on iOS.
const FORMAT =
  Platform.OS === 'android'
    ? { mime: 'audio/3gpp', ext: '3gp' }
    : { mime: 'audio/mp4', ext: 'm4a' };
const EXTENSIONS: Record<string, string> = { 'audio/3gpp': '3gp', 'audio/mp4': 'm4a' };

function deleteFile(uri: string | null): void {
  if (!uri) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

/**
 * Records a voice note. The recording file is read into memory (and then saved
 * encrypted) and deleted at once, even if stopping fails.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [recording, setRecording] = useState(false);
  // Refs keep stop/cancel stable, so a screen can cancel on unmount only.
  const startedAt = useRef(0);
  const active = useRef(false);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return 'denied' as const;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_SECONDS });
    startedAt.current = Date.now();
    active.current = true;
    setRecording(true);
    return 'started' as const;
  }, [recorder]);

  const finish = useCallback(
    async (keep: boolean): Promise<RecordedVoice | null> => {
      if (!active.current) return null;
      active.current = false;
      try {
        // It may already have stopped itself at the time limit.
        await recorder.stop().catch(() => {});
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        if (!keep || !recorder.uri) return null;
        const bytes = await new File(recorder.uri).bytes();
        const durationMs = Math.min(Date.now() - startedAt.current, MAX_SECONDS * 1000);
        return { bytes, mime: FORMAT.mime, durationMs };
      } finally {
        setRecording(false);
        deleteFile(recorder.uri);
      }
    },
    [recorder],
  );

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(async () => {
    await finish(false);
  }, [finish]);

  return { recording, start, stop, cancel };
}

let current: { player: AudioPlayer; file: File; remove: () => void } | null = null;

/** Stops any voice note that is playing and deletes its temporary copy. */
export function stopVoice(): void {
  if (!current) return;
  const { player, file, remove } = current;
  current = null;
  remove();
  player.pause();
  player.remove();
  if (file.exists) file.delete();
}

/** Plays a voice note from the database through a short-lived temp file. */
export async function playVoice(bytes: Uint8Array, mime: string): Promise<void> {
  stopVoice();
  const dir = new Directory(Paths.cache, 'rc-voice');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `play-${Date.now()}.${EXTENSIONS[mime] ?? FORMAT.ext}`);
  await file.write(bytes);
  const player = createAudioPlayer({ uri: file.uri });
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) stopVoice();
  });
  current = { player, file, remove: () => subscription.remove() };
  player.play();
}
