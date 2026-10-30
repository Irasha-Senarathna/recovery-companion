import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';

/**
 * A quiet dawn: a low sun, two soft hills and a lagoon wave. Purely
 * decorative, so it is hidden from screen readers.
 */
export function CalmScene({ height = 140 }: { height?: number }) {
  const theme = useTheme();
  const [deep, mid, warm] = theme.wave;
  // Unique per instance: several scenes can sit in the navigation stack at once.
  const sunId = `sun-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 360 140"
      preserveAspectRatio="xMidYMax slice"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={sunId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.sun} stopOpacity="0.95" />
          <Stop offset="1" stopColor={theme.sun} stopOpacity="0.45" />
        </LinearGradient>
      </Defs>
      <Circle cx="262" cy="62" r="52" fill={warm} />
      <Circle cx="262" cy="62" r="34" fill={`url(#${sunId})`} />
      <Path d="M0 98 C 60 62, 120 64, 180 92 S 300 118, 360 84 L 360 140 L 0 140 Z" fill={mid} />
      <Path
        d="M0 112 C 80 86, 150 96, 220 112 S 320 126, 360 108 L 360 140 L 0 140 Z"
        fill={deep}
      />
      <Path
        d="M0 126 C 40 118, 80 134, 120 126 S 200 118, 240 126 S 320 134, 360 124 L 360 140 L 0 140 Z"
        fill={theme.primary}
        fillOpacity="0.22"
      />
    </Svg>
  );
}
