import '../i18n';
import { Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useShakeToHide } from '../features/hide/useShakeToHide';
import { useAutoLock } from '../features/lock/useAutoLock';
import {
  SessionProvider,
  useSession,
  type SessionStatus,
} from '../features/session/SessionProvider';
import { useSecureScreen } from '../platform/secureScreen';
import { useTheme } from '../theme';

export default function RootLayout() {
  return (
    <SessionProvider>
      <AppStack />
    </SessionProvider>
  );
}

const HOME: Record<SessionStatus, Href> = {
  loading: '/loading',
  onboarding: '/onboarding',
  locked: '/lock',
  unlocked: '/',
  error: '/problem',
};

/** Which screens exist depends on the session; help is always reachable. */
function AppStack() {
  const theme = useTheme();
  const { status, hidden, settings, lock, hide } = useSession();
  const unlocked = status === 'unlocked' && !hidden;

  useSecureScreen();
  useAutoLock({ enabled: unlocked, onLock: lock });
  useShakeToHide({ enabled: unlocked && settings.shakeToHide, onShake: hide });

  // A closed guard sends the user to the screen for the current state.
  const redirectTo: Href = hidden ? '/hidden' : HOME[status];

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      >
        <Stack.Protected redirectTo={redirectTo} guard={unlocked}>
          <Stack.Screen name="index" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="sos" />
          <Stack.Screen name="vault" />
          <Stack.Screen name="progress" />
          <Stack.Screen name="checkin" />
          <Stack.Screen name="triggers" />
          <Stack.Screen name="coping-plan" />
        </Stack.Protected>
        <Stack.Protected redirectTo={redirectTo} guard={hidden}>
          <Stack.Screen name="hidden" />
        </Stack.Protected>
        <Stack.Protected redirectTo={redirectTo} guard={status === 'locked' && !hidden}>
          <Stack.Screen name="lock" />
        </Stack.Protected>
        <Stack.Protected redirectTo={redirectTo} guard={status === 'onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected redirectTo={redirectTo} guard={status === 'loading'}>
          <Stack.Screen name="loading" />
        </Stack.Protected>
        <Stack.Protected redirectTo={redirectTo} guard={status === 'error'}>
          <Stack.Screen name="problem" />
        </Stack.Protected>
        <Stack.Screen name="help" />
      </Stack>
    </>
  );
}
