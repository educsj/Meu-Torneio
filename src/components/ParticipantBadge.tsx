import { Text, View } from 'react-native';

import {
  DEFAULT_PARTICIPANT_COLOR,
  getIconById,
} from '@/utils/icons';

interface Props {
  /** Persisted icon id from PARTICIPANT_ICONS. Null/unknown → initials. */
  icon: string | null | undefined;
  /** Hex color for the circle background. Null falls back to brand blue
   *  when an icon is set; ignored when there's no icon (initials use a
   *  neutral slate background). */
  iconColor: string | null | undefined;
  /** Used to derive the initials fallback. */
  name: string;
  /** Outer diameter in px. The icon glyph sizes itself proportionally. */
  size?: number;
}

/**
 * Compact participant avatar — colored circle with either the chosen
 * lucide icon (white stroke) or, when no icon was picked, the first 1–2
 * letters of the participant's name on a neutral background.
 */
export function ParticipantBadge({ icon, iconColor, name, size = 28 }: Props) {
  const Icon = getIconById(icon);
  const bg = Icon ? (iconColor ?? DEFAULT_PARTICIPANT_COLOR) : '#64748b';
  const glyphSize = Math.round(size * 0.55);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Icon ? (
        <Icon size={glyphSize} color="#ffffff" strokeWidth={2.2} />
      ) : (
        <Text
          style={{
            color: '#ffffff',
            fontSize: Math.max(10, Math.round(size * 0.42)),
            fontWeight: '700',
          }}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
