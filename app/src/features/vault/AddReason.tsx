import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { SafeTextInput } from '../../components/SafeTextInput';
import { pickPhoto } from '../../platform/photos';
import { useVoiceRecorder, VOICE_SUPPORTED } from '../../platform/voice';
import type { Database } from '../../storage/types';
import { addPhoto, addText, addVoice, TEXT_MAX, VaultError } from './vaultRepo';

export function AddReason({ db, onAdded }: { db: Database; onAdded: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const voice = useVoiceRecorder();
  const { cancel } = voice;

  // Leaving the screen (or a lock/hide) mid-recording discards the recording.
  useEffect(() => () => void cancel(), [cancel]);

  /** Runs a save and turns vault limits into a kind message. */
  const save = async (action: () => Promise<unknown>) => {
    setMessage(null);
    try {
      await action();
      onAdded();
      return true;
    } catch (error) {
      if (!(error instanceof VaultError)) throw error;
      setMessage(t(`vault.errors.${error.code}`));
      return false;
    }
  };

  const saveText = async () => {
    if (await save(() => addText(db, text))) setText('');
  };

  const savePhoto = async () => {
    const photo = await pickPhoto();
    if (photo) await save(() => addPhoto(db, photo.bytes, photo.mime));
  };

  const toggleVoice = async () => {
    if (!voice.recording) {
      if ((await voice.start()) === 'denied') setMessage(t('vault.micDenied'));
      return;
    }
    const note = await voice.stop();
    if (note) await save(() => addVoice(db, note.bytes, note.mime, note.durationMs));
  };

  return (
    <Card tone="soft">
      <SafeTextInput
        testID="vault-text-input"
        label={t('vault.textLabel')}
        value={text}
        onChangeText={setText}
        maxLength={TEXT_MAX}
        multiline
      />
      <ActionButton testID="vault-add-text" label={t('vault.addText')} onPress={saveText} />
      <ActionButton
        testID="vault-add-photo"
        tone="plain"
        label={t('vault.addPhoto')}
        onPress={savePhoto}
      />
      {VOICE_SUPPORTED ? (
        <ActionButton
          testID="vault-record"
          tone="plain"
          label={voice.recording ? t('vault.stopVoice') : t('vault.recordVoice')}
          hint={voice.recording ? t('vault.recording') : undefined}
          onPress={toggleVoice}
        />
      ) : (
        <BodyText>{t('vault.voicePhoneOnly')}</BodyText>
      )}
      {message ? <BodyText>{message}</BodyText> : null}
    </Card>
  );
}
