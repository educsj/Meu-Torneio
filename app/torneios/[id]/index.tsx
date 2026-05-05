import { useLocalSearchParams } from 'expo-router';

import { ParticipantList } from '@/components/ParticipantList';

export default function ParticipantsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) return null;
  return <ParticipantList tournamentId={tournamentId} />;
}
