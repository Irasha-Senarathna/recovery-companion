import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import i18n, { deviceLanguage, type Language } from '../../i18n';
import { canUseBiometrics, unlockWithBiometricToken } from '../../platform/biometrics';
import { secureStore } from '../../platform/secureStore';
import { deleteAllData, type DeleteAllResult } from '../../storage/deleteAll';
import { DEFAULT_SETTINGS, saveSettings, type AppSettings } from '../../storage/settings';
import type { Database } from '../../storage/types';
import { checkPin, resetAttempts, savePin, type PinCheck } from '../lock/pin';
import { boot, type BootResult } from './boot';

export type SessionStatus = 'loading' | 'onboarding' | 'locked' | 'unlocked' | 'error';

export type OnboardingInput = { nickname: string; pin: string; language: Language };

export type Session = {
  status: SessionStatus;
  /** Quick-hide is showing the neutral screen. */
  hidden: boolean;
  settings: AppSettings;
  biometricsAvailable: boolean;
  unlockWithPin: (pin: string) => Promise<PinCheck>;
  unlockWithBiometrics: (prompt: string) => Promise<boolean>;
  lock: () => void;
  hide: () => void;
  unhide: () => void;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  deleteEverything: () => Promise<DeleteAllResult>;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useRef<Database | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [hidden, setHidden] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const apply = useCallback((result: BootResult) => {
    db.current = result.db;
    setSettings(result.settings);
    if (result.settings.language) i18n.changeLanguage(result.settings.language);
    setHidden(false);
    setStatus(result.status);
  }, []);

  useEffect(() => {
    let mounted = true;
    boot(secureStore).then((result) => mounted && apply(result));
    canUseBiometrics().then(
      (available) => mounted && setBiometricsAvailable(available),
      () => mounted && setBiometricsAvailable(false),
    );
    return () => {
      mounted = false;
    };
  }, [apply]);

  const lock = useCallback(() => setStatus((s) => (s === 'unlocked' ? 'locked' : s)), []);

  const hide = useCallback(() => {
    setHidden(true);
    lock();
  }, [lock]);

  const unhide = useCallback(() => setHidden(false), []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const result = await checkPin(secureStore, pin);
    if (result.status === 'ok') setStatus('unlocked');
    return result;
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    if (db.current) await saveSettings(db.current, patch);
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const unlockWithBiometrics = useCallback(
    async (prompt: string) => {
      if (!settings.biometricEnabled) return false;
      const result = await unlockWithBiometricToken(prompt);
      if (result === 'ok') {
        await resetAttempts(secureStore);
        setStatus('unlocked');
      }
      // Enrolment changed (someone added a fingerprint or face): PIN only from now on.
      if (result === 'invalidated') await updateSettings({ biometricEnabled: false });
      return result === 'ok';
    },
    [settings.biometricEnabled, updateSettings],
  );


  const completeOnboarding = useCallback(
    async ({ nickname, pin, language }: OnboardingInput) => {
      await savePin(secureStore, pin);
      await updateSettings({ nickname, language, onboarded: true });
      setStatus('unlocked');
    },
    [updateSettings],
  );

  const deleteEverything = useCallback(async () => {
    const result = await deleteAllData({ db: db.current, store: secureStore });
    db.current = null;
    await i18n.changeLanguage(deviceLanguage());
    apply(await boot(secureStore));
    return result;
  }, [apply]);

  const session = useMemo<Session>(
    () => ({
      status,
      hidden,
      settings,
      biometricsAvailable,
      unlockWithPin,
      unlockWithBiometrics,
      lock,
      hide,
      unhide,
      completeOnboarding,
      updateSettings,
      deleteEverything,
    }),
    [
      status,
      hidden,
      settings,
      biometricsAvailable,
      unlockWithPin,
      unlockWithBiometrics,
      lock,
      hide,
      unhide,
      completeOnboarding,
      updateSettings,
      deleteEverything,
    ],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
