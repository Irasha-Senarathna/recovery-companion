import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';
import { ActionButton } from './ActionButton';
import { BodyText } from './BodyText';
import { Card } from './Card';

type Props = {
  message: string;
  testID: string;
  title?: string;
  titleTestID?: string;
  /** One gentle next step, if there is an obvious one. */
  action?: { label: string; onPress: () => void; testID: string };
};

/** What a list shows before it has anything in it: calm words, never a blank space. */
export function EmptyState({ message, testID, title, titleTestID, action }: Props) {
  const theme = useTheme();
  return (
    <Card tone="soft" testID={testID}>
      {title ? (
        <Text
          testID={titleTestID}
          accessibilityRole="header"
          style={[styles.title, { color: theme.text }]}
        >
          {title}
        </Text>
      ) : null}
      <BodyText>{message}</BodyText>
      {action ? (
        <ActionButton
          testID={action.testID}
          tone="plain"
          label={action.label}
          onPress={action.onPress}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
});
