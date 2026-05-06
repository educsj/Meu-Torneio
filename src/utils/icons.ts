import {
  Anchor,
  Award,
  Bird,
  Bot,
  Cat,
  Crown,
  Diamond,
  Dog,
  Drama,
  Dumbbell,
  Feather,
  Flame,
  Flower,
  Ghost,
  Globe,
  Heart,
  Music,
  Pizza,
  Rocket,
  Shield,
  Skull,
  Snowflake,
  Star,
  Sun,
  Sword,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * Curated badge catalog for participants. The id is what's persisted in
 * the DB, so adding/renaming entries needs migration thought — removing one
 * would orphan existing rows that reference it. Adding new entries at the
 * end is always safe.
 *
 * Icons chosen to read recognisably at 24-40px and be culturally generic
 * (no team / brand marks). Lucide stroke-only style scales well to small
 * sizes inside the colored circle.
 */
export interface IconChoice {
  id: string;
  Icon: LucideIcon;
}

export const PARTICIPANT_ICONS: IconChoice[] = [
  { id: 'trophy', Icon: Trophy },
  { id: 'star', Icon: Star },
  { id: 'crown', Icon: Crown },
  { id: 'shield', Icon: Shield },
  { id: 'flame', Icon: Flame },
  { id: 'zap', Icon: Zap },
  { id: 'heart', Icon: Heart },
  { id: 'sword', Icon: Sword },
  { id: 'skull', Icon: Skull },
  { id: 'target', Icon: Target },
  { id: 'rocket', Icon: Rocket },
  { id: 'diamond', Icon: Diamond },
  { id: 'anchor', Icon: Anchor },
  { id: 'feather', Icon: Feather },
  { id: 'snowflake', Icon: Snowflake },
  { id: 'sun', Icon: Sun },
  { id: 'globe', Icon: Globe },
  { id: 'flower', Icon: Flower },
  { id: 'ghost', Icon: Ghost },
  { id: 'bot', Icon: Bot },
  { id: 'dog', Icon: Dog },
  { id: 'cat', Icon: Cat },
  { id: 'bird', Icon: Bird },
  { id: 'pizza', Icon: Pizza },
  { id: 'music', Icon: Music },
  { id: 'drama', Icon: Drama },
  { id: 'dumbbell', Icon: Dumbbell },
  { id: 'award', Icon: Award },
];

const ICON_BY_ID = new Map(PARTICIPANT_ICONS.map((c) => [c.id, c.Icon]));

/** Lookup an icon component by its persisted id. Returns null when the id
 *  is unknown (e.g. catalog was trimmed) so the caller can fall back. */
export function getIconById(id: string | null | undefined): LucideIcon | null {
  if (!id) return null;
  return ICON_BY_ID.get(id) ?? null;
}

/**
 * Curated palette for the badge background. Each color is bright enough
 * to give a colored chip readability against both light and dark themes,
 * with a white-stroke icon on top.
 */
export const PARTICIPANT_COLORS: string[] = [
  '#1a78f5', // brand blue
  '#ef4444', // red
  '#f59e0b', // amber
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#0ea5e9', // sky
  '#64748b', // slate (neutral)
];

export const DEFAULT_PARTICIPANT_COLOR = PARTICIPANT_COLORS[0];
