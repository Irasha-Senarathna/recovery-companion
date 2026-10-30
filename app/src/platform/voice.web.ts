import type { RecordedVoice, VoiceRecorder } from './voice';

/** Web demo stand-in: voice notes are phone-only. */
export const VOICE_SUPPORTED = false;

export function useVoiceRecorder(): VoiceRecorder {
  return {
    recording: false,
    start: async () => 'denied',
    stop: async (): Promise<RecordedVoice | null> => null,
    cancel: async () => {},
  };
}

export async function playVoice(): Promise<void> {}

export function stopVoice(): void {}
