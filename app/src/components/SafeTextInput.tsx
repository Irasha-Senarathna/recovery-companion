import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { detectCrisis } from '../safety/crisisDetector';
import { MIN_TAP, RADIUS, useTheme } from '../theme';

type Props = Omit<TextInputProps, 'onChangeText' | 'value' | 'style'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  hint?: string;
  error?: string | null;
};

/**
 * The only text field in the app (safety rule 4): if crisis words are typed,
 * help resources open straight away. Keyboard learning, autocorrect and
 * autofill are off, so private words never turn up as suggestions elsewhere.
 */
export function SafeTextInput({ label, value, onChangeText, hint, error, ...rest }: Props) {
  const theme = useTheme();
  const router = useRouter();

  // Only newly typed crisis words open help, so editing saved text that
  // already mentions a hard moment does not send the user away each time.
  const handleChange = (text: string) => {
    onChangeText(text);
    if (detectCrisis(text) && !detectCrisis(value)) {
      router.push({ pathname: '/help', params: { reason: 'crisis' } });
    }
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        {...rest}
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onChangeText={handleChange}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: theme.outline },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: theme.help }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 17, fontWeight: '600' },
  input: {
    minHeight: MIN_TAP + 8,
    borderWidth: 1.5,
    borderRadius: RADIUS.button,
    paddingHorizontal: 16,
    fontSize: 18,
  },
  hint: { fontSize: 15, lineHeight: 22 },
});
