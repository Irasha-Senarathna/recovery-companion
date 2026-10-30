import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { SafeTextInput } from '../../components/SafeTextInput';
import { isPlausiblePhone, normalizePhone } from '../../utils/phone';
import { useSession } from '../session/SessionProvider';

/** One trusted person for "Call my support person". Stored only on this phone. */
export function SupportPersonForm() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSession();
  const [name, setName] = useState(settings.supportName ?? '');
  const [phone, setPhone] = useState(settings.supportPhone ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName || !isPlausiblePhone(phone)) {
      setMessage(t('settings.supportInvalid'));
      return;
    }
    // Saved as digits only, so the call button always dials the whole number.
    const cleanPhone = normalizePhone(phone);
    await updateSettings({ supportName: cleanName, supportPhone: cleanPhone });
    setPhone(cleanPhone);
    setMessage(t('settings.supportSaved'));
  };

  const remove = async () => {
    await updateSettings({ supportName: null, supportPhone: null });
    setName('');
    setPhone('');
    setMessage(null);
  };

  return (
    <>
      <BodyText>{t('settings.supportInfo')}</BodyText>
      <SafeTextInput
        testID="support-name"
        label={t('settings.supportName')}
        value={name}
        onChangeText={setName}
        maxLength={40}
      />
      <SafeTextInput
        testID="support-phone"
        label={t('settings.supportPhone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={20}
      />
      <ActionButton testID="support-save" label={t('settings.supportSave')} onPress={save} />
      {settings.supportName ? (
        <ActionButton
          testID="support-remove"
          tone="plain"
          label={t('settings.supportRemove')}
          onPress={remove}
        />
      ) : null}
      {message ? <BodyText>{message}</BodyText> : null}
    </>
  );
}
