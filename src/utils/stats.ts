import type {
  Match,
  Participant,
  ScoringRule,
  TournamentStatus,
  TournamentType,
} from '@/types/tournament';

import { GRAND_FINAL_LABEL, THIRD_PLACE_LABEL } from './bracket';
import { computeStandings } from './standings';

/**
 * Everything the cross-tournament stats need from a single tournament. Kept
 * DB-agnostic so the aggregation is a pure, testable function.
 */
export interface TournamentBundle {
  type: TournamentType;
  status: TournamentStatus;
  participants: Participant[];
  matches: Match[];
  /** Scoring rule of the standings-producing phase (round_robin). Only used
   *  to pick a round-robin champion; defaults to 'fifa'. */
  scoring?: ScoringRule;
}

/** One aggregated row, keyed by the participant's (trimmed) name so the same
 *  competitor across different tournaments is merged. */
export interface AggregateStatRow {
  name: string;
  tournaments: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  titles: number;
}

/**
 * The participant id that won a finished tournament, or null when it can't be
 * confidently determined (unfinished, or a custom shape with no clear final).
 * Wins/losses everywhere else are decided purely by score comparison, so this
 * is the one place that needs per-format knowledge of "who lifted the cup".
 */
export function championParticipantId(b: TournamentBundle): number | null {
  if (b.status !== 'finished') return null;
  const isThird = (m: Match) => m.groupLabel === THIRD_PLACE_LABEL;
  const m = b.matches;

  switch (b.type) {
    case 'single_elimination': {
      const final = m.find(
        (x) => x.stage !== 'group' && x.nextMatchId == null && !isThird(x)
      );
      return final?.winnerId ?? null;
    }
    case 'groups_knockout': {
      const ko = m.filter((x) => x.stage === 'knockout');
      const final = ko.find((x) => x.nextMatchId == null && !isThird(x));
      return final?.winnerId ?? null;
    }
    case 'double_elimination': {
      // The deciding grand final is the last GF that has a winner (GF2 when a
      // bracket reset was played, otherwise GF1).
      const gfs = m
        .filter((x) => x.groupLabel === GRAND_FINAL_LABEL)
        .sort((a, x) => (a.round ?? 1) - (x.round ?? 1));
      const decided = [...gfs].reverse().find((x) => x.winnerId != null);
      return decided?.winnerId ?? null;
    }
    case 'league_playoff': {
      // Placement matches are parallel; the 1st-vs-2nd final is the lowest-id
      // knockout match (3rd-place playoff sorts after it).
      const playoff = m
        .filter((x) => x.stage === 'knockout')
        .sort((a, x) => a.id - x.id);
      return playoff[0]?.winnerId ?? null;
    }
    case 'round_robin': {
      const standings = computeStandings(m, b.participants, {
        scoring: b.scoring,
      });
      return standings[0]?.participantId ?? null;
    }
    case 'custom': {
      // Knockout-ending custom (e.g. World Cup): the bracket final, or — for a
      // placement-style ending — the lowest-id knockout match.
      const ko = m.filter((x) => x.stage === 'knockout');
      if (ko.length > 0) {
        const final = ko.find((x) => x.nextMatchId == null && !isThird(x));
        if (final?.winnerId != null) return final.winnerId;
        const byId = [...ko].sort((a, x) => a.id - x.id);
        if (byId[0]?.winnerId != null) return byId[0].winnerId;
      }
      // League-ending custom: champion = top of the league standings.
      const league = m.filter((x) => x.stage === 'group' || x.stage === 'main');
      if (league.length > 0 && league.every((x) => x.scoreA != null)) {
        const standings = computeStandings(league, b.participants, {
          scoring: b.scoring,
        });
        return standings[0]?.participantId ?? null;
      }
      return null;
    }
  }
}

/**
 * Aggregate per-participant stats across many tournaments, merged by name.
 * Wins/draws/losses and goals come from every played match; titles come from
 * championParticipantId on finished tournaments. Rows are sorted by the given
 * metric (descending), then by goal difference, then alphabetically.
 */
export function aggregateParticipantStats(
  bundles: TournamentBundle[],
  sortBy: 'goalsFor' | 'wins' | 'titles' = 'goalsFor'
): AggregateStatRow[] {
  const rows = new Map<string, AggregateStatRow>();
  const seenInTournament = new Map<string, Set<number>>();

  const rowFor = (name: string): AggregateStatRow => {
    let row = rows.get(name);
    if (!row) {
      row = {
        name,
        tournaments: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        titles: 0,
      };
      rows.set(name, row);
    }
    return row;
  };

  bundles.forEach((b, tIndex) => {
    const nameById = new Map<number, string>();
    for (const p of b.participants) {
      const name = p.name.trim();
      if (!name) continue;
      nameById.set(p.id, name);
      // Count one tournament-appearance per distinct name per tournament.
      let seen = seenInTournament.get(name);
      if (!seen) {
        seen = new Set<number>();
        seenInTournament.set(name, seen);
      }
      if (!seen.has(tIndex)) {
        seen.add(tIndex);
        rowFor(name).tournaments++;
      }
    }

    for (const match of b.matches) {
      if (
        match.participantAId == null ||
        match.participantBId == null ||
        match.scoreA == null ||
        match.scoreB == null
      ) {
        continue;
      }
      const nameA = nameById.get(match.participantAId);
      const nameB = nameById.get(match.participantBId);
      if (!nameA || !nameB) continue;
      const rowA = rowFor(nameA);
      const rowB = rowFor(nameB);
      rowA.played++;
      rowB.played++;
      rowA.goalsFor += match.scoreA;
      rowA.goalsAgainst += match.scoreB;
      rowB.goalsFor += match.scoreB;
      rowB.goalsAgainst += match.scoreA;
      if (match.scoreA > match.scoreB) {
        rowA.wins++;
        rowB.losses++;
      } else if (match.scoreB > match.scoreA) {
        rowB.wins++;
        rowA.losses++;
      } else {
        rowA.draws++;
        rowB.draws++;
      }
    }

    const champId = championParticipantId(b);
    if (champId != null) {
      const champName = nameById.get(champId);
      if (champName) rowFor(champName).titles++;
    }
  });

  const list = [...rows.values()];
  for (const r of list) r.goalDiff = r.goalsFor - r.goalsAgainst;
  list.sort(
    (a, b) =>
      b[sortBy] - a[sortBy] ||
      b.goalDiff - a.goalDiff ||
      a.name.localeCompare(b.name)
  );
  return list;
}
