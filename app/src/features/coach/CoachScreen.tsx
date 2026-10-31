import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { SafeTextInput } from '../../components/SafeTextInput';
import { ScreenLayout } from '../../components/ScreenLayout';
import { isLanguage } from '../../i18n';
import { isUnencrypted } from '../../net/baseUrl';
import {
  coachBaseUrl,
  CoachError,
  MAX_TEXT,
  type CoachClient,
  type CoachReply,
} from '../../net/coachClient';
import { RADIUS, useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { historyOf, planSend, type Entry, type NewEntry } from './chat';
import { useCoachClient } from './client';
import { CoachOptIn } from './CoachOptIn';

const CRISIS: CoachReply = { kind: 'crisis', topic: null, text: null, reachOut: false };

/** Optional AI coping coach (milestone 9). Off until the user turns it on. */
export function CoachScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const client = useCoachClient();
  const { settings, updateSettings } = useSession();
  const unencrypted = isUnencrypted(coachBaseUrl());

  return (
    <ScreenLayout title={t('coach.title')} testID="coach-screen">
      {unencrypted ? (
        <Text style={[styles.warning, { color: theme.text, borderColor: theme.help }]}>
          {t('coach.unencrypted')}
        </Text>
      ) : null}
      {settings.coachEnabled && client ? (
        <CoachChat
          client={client}
          onTurnOff={() => updateSettings({ coachEnabled: false })}
          openHelp={() => router.push({ pathname: '/help', params: { reason: 'crisis' } })}
        />
      ) : (
        <CoachOptIn
          available={client !== null}
          onTurnOn={() => updateSettings({ coachEnabled: true })}
        />
      )}
      <ActionButton
        testID="coach-back"
        tone="plain"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </ScreenLayout>
  );
}

type ChatProps = { client: CoachClient; onTurnOff: () => void; openHelp: () => void };

/**
 * The chat itself, held in memory only. After any crisis (found on the phone
 * or by the service) the coach pauses for the rest of this visit: help stays
 * pinned and nothing more is sent.
 */
export function CoachChat({ client, onTurnOff, openHelp }: ChatProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  // Bumped by Clear and Turn off, so a reply still on its way is dropped.
  const generation = useRef(0);

  const add = (entry: NewEntry) =>
    setEntries((prev) => [...prev, { ...entry, id: prev.length } as Entry]);

  const crisis = () => {
    setPaused(true);
    add({ from: 'coach', reply: CRISIS });
    openHelp();
  };

  const send = async () => {
    const { action, message } = planSend(draft);
    if (action === 'none' || busy || paused) return;
    setDraft('');
    if (action === 'crisis') {
      add({ from: 'user', text: message, sent: false });
      crisis();
      return;
    }
    const history = historyOf(entries);
    const asked = generation.current;
    add({ from: 'user', text: message, sent: true });
    setBusy(true);
    try {
      const lang = isLanguage(i18n.language) ? i18n.language : 'en';
      const reply = await client.send({ lang, message, history });
      if (generation.current !== asked) return;
      if (reply.kind === 'crisis') crisis();
      else add({ from: 'coach', reply });
    } catch (error) {
      if (generation.current !== asked) return;
      add({ from: 'error', kind: error instanceof CoachError ? error.kind : 'server' });
    } finally {
      if (generation.current === asked) setBusy(false);
    }
  };

  const clear = () => {
    generation.current += 1;
    setEntries([]);
    setBusy(false);
  };

  return (
    <>
      <Text style={[styles.notice, { color: theme.textMuted }]}>{t('coach.notTherapist')}</Text>
      {entries.length === 0 ? <BodyText>{t('coach.empty')}</BodyText> : null}
      {entries.map((entry) => (
        <ChatEntry key={entry.id} entry={entry} />
      ))}
      {busy ? (
        <Text
          testID="coach-thinking"
          accessibilityLiveRegion="polite"
          style={[styles.notice, { color: theme.textMuted }]}
        >
          {t('coach.thinking')}
        </Text>
      ) : null}
      {paused ? (
        <Card tone="soft" testID="coach-paused">
          <BodyText>{t('coach.paused')}</BodyText>
          <HelpButtons crisis />
        </Card>
      ) : (
        <>
          <SafeTextInput
            testID="coach-input"
            label={t('coach.inputLabel')}
            hint={t('coach.inputHint', { count: MAX_TEXT })}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_TEXT}
            multiline
          />
          <ActionButton
            testID="coach-send"
            label={t('coach.send')}
            disabled={busy || !draft.trim()}
            onPress={send}
          />
        </>
      )}
      {entries.length > 0 ? (
        <ActionButton testID="coach-clear" tone="plain" label={t('coach.clear')} onPress={clear} />
      ) : null}
      <ActionButton
        testID="coach-turn-off"
        tone="plain"
        label={t('coach.turnOff')}
        onPress={() => {
          clear();
          onTurnOff();
        }}
      />
    </>
  );
}

function ChatEntry({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (entry.from === 'user') {
    return (
      <View
        accessible
        accessibilityLabel={`${t('coach.you')}: ${entry.text}`}
        style={[styles.bubble, styles.mine, { backgroundColor: theme.surfaceSoft }]}
      >
        <Text style={[styles.text, { color: theme.text }]}>{entry.text}</Text>
      </View>
    );
  }
  if (entry.from === 'error') {
    return (
      <Card tone="soft" testID="coach-error">
        <Text accessibilityLiveRegion="polite" style={[styles.text, { color: theme.text }]}>
          {t(`coach.errors.${entry.kind}`)}
        </Text>
        <HelpButtons />
      </Card>
    );
  }

  const { reply } = entry;
  if (reply.kind === 'reply') {
    return (
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${t('coach.coach')}: ${reply.text}`}
        style={[styles.bubble, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[styles.text, { color: theme.text }]}>{reply.text}</Text>
        {reply.reachOut ? (
          <Text style={[styles.note, { color: theme.textMuted }]}>{t('coach.reachOut')}</Text>
        ) : null}
      </View>
    );
  }
  if (reply.kind === 'crisis') {
    return (
      <Card tone="soft" testID="coach-crisis">
        <Text accessibilityLiveRegion="assertive" style={[styles.text, { color: theme.text }]}>
          {t('coach.crisis')}
        </Text>
        <HelpButtons crisis />
      </Card>
    );
  }
  const message =
    reply.kind === 'refusal' ? t(`coach.refusal.${reply.topic}`) : t('coach.fallback');
  return (
    <Card tone="soft" testID={`coach-${reply.kind}`}>
      <Text accessibilityLiveRegion="polite" style={[styles.text, { color: theme.text }]}>
        {message}
      </Text>
      <HelpButtons />
    </Card>
  );
}

/** Help that never depends on the coach. */
function HelpButtons({ crisis = false }: { crisis?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <ActionButton
        testID="coach-open-help"
        tone="danger"
        label={t('coach.openHelp')}
        onPress={() =>
          router.push(crisis ? { pathname: '/help', params: { reason: 'crisis' } } : '/help')
        }
      />
      {crisis ? null : (
        <ActionButton
          testID="coach-open-sos"
          tone="soft"
          label={t('coach.openSos')}
          onPress={() => router.push('/sos')}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  notice: { fontSize: 15, lineHeight: 22 },
  warning: { fontSize: 15, lineHeight: 22, fontWeight: '600', borderLeftWidth: 3, paddingLeft: 12 },
  bubble: {
    padding: 14,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 8,
  },
  mine: { alignSelf: 'flex-end', maxWidth: '90%' },
  text: { fontSize: 17, lineHeight: 26 },
  note: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
});
