import type { Bus, Route } from '../../../packages/shared/src/types/bus.js';
import { matchPointToRoute } from '../../../packages/shared/src/engine/routeMatcher.js';
import { rankBusCandidates, type BusCandidateInput } from './busCandidateMatcher.js';

export interface TrajectorySample extends BusCandidateInput {
  sessionId: string;
  timestamp: string;
}
export interface TrajectoryCandidate {
  busId: string;
  busLabel: string;
  routeId: string;
  routeName: string;
  score: number;
  supportingSamples: number;
  medianRouteDistanceMeters: number;
  evidence: string[];
}
export interface TrajectoryMatchResult {
  status: 'CORROBORATED_CANDIDATE' | 'AMBIGUOUS' | 'INSUFFICIENT_SAMPLES' | 'NO_MATCH';
  selected?: TrajectoryCandidate;
  candidates: TrajectoryCandidate[];
  explanation: string;
}

/**
 * Corroborates a possible bus/route using multiple time-separated, explicitly consented samples.
 * It never declares legal/physical vehicle identity verified; it only ranks a stronger candidate.
 */
export function rankTrajectoryCandidates(
  buses: Bus[],
  routes: Route[],
  samples: TrajectorySample[],
  now = new Date(),
): TrajectoryMatchResult {
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > 6) {
    return { status: 'INSUFFICIENT_SAMPLES', candidates: [], explanation: 'At least two and no more than six consented location samples are required.' };
  }
  const ordered = [...samples].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const parsed = ordered.map(sample => new Date(sample.timestamp).getTime());
  if (parsed.some(value => !Number.isFinite(value)) || parsed[0] < now.getTime() - 15 * 60 * 1000 ||
      parsed[parsed.length - 1] > now.getTime() + 60 * 1000) {
    return { status: 'NO_MATCH', candidates: [], explanation: 'One or more samples are invalid, too old or from the future.' };
  }
  for (let i = 0; i < ordered.length; i++) {
    const sample = ordered[i];
    if (!sample.sessionId || !Number.isFinite(sample.latitude) || sample.latitude < 6 || sample.latitude > 38 ||
        !Number.isFinite(sample.longitude) || sample.longitude < 68 || sample.longitude > 98 ||
        !Number.isFinite(sample.accuracyMeters) || sample.accuracyMeters <= 0 || sample.accuracyMeters > 250 ||
        (i > 0 && (parsed[i] - parsed[i - 1] < 20_000 || parsed[i] - parsed[i - 1] > 10 * 60 * 1000))) {
      return { status: 'NO_MATCH', candidates: [], explanation: 'Samples must be valid India GPS fixes, accurate within 250 metres and spaced 20 seconds to 10 minutes apart.' };
    }
  }

  const byBus = new Map<string, { bus: Bus; route: Route; scores: number[]; distances: number[]; evidence: Set<string> }>();
  for (let i = 0; i < ordered.length; i++) {
    const sample = ordered[i];
    const routeSet = routes;
    const ranked = rankBusCandidates(buses, routeSet, sample, new Date(parsed[i]));
    for (const candidate of ranked.candidates) {
      const bus = buses.find(item => item.id === candidate.busId);
      const route = routes.find(item => item.id === candidate.routeId);
      if (!bus || !route) continue;
      const entry = byBus.get(bus.id) || { bus, route, scores: [], distances: [], evidence: new Set<string>() };
      entry.scores.push(candidate.score);
      entry.distances.push(candidate.routeDistanceMeters);
      candidate.evidence.forEach(item => entry.evidence.add(item));
      byBus.set(bus.id, entry);
    }
  }

  const candidates: TrajectoryCandidate[] = [];
  for (const [busId, entry] of byBus) {
    if (entry.scores.length < 2) continue;
    let movementConsistent = true;
    const route = entry.route;
    let previousProgress = -1;
    for (const sample of ordered) {
      const match = matchPointToRoute(sample.latitude, sample.longitude, route, Math.max(250, sample.accuracyMeters * 2));
      if (!match.isMatched || (previousProgress >= 0 && match.estimatedProgressRatio < previousProgress - 0.15)) {
        movementConsistent = false; break;
      }
      previousProgress = match.estimatedProgressRatio;
    }
    if (!movementConsistent) continue;

    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1], b = ordered[i];
      const elapsedHours = (parsed[i] - parsed[i - 1]) / 3600000;
      const dLat = (b.latitude - a.latitude) * 111320;
      const dLon = (b.longitude - a.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
      const impliedSpeed = Math.hypot(dLat, dLon) / 1000 / elapsedHours;
      if (impliedSpeed > 120) { movementConsistent = false; break; }
    }
    if (!movementConsistent) continue;
    const sorted = [...entry.scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const distances = [...entry.distances].sort((a, b) => a - b);
    candidates.push({
      busId, busLabel: entry.bus.publicIdentifier, routeId: route.id, routeName: route.routeName,
      score: Math.round(median + Math.min(12, (entry.scores.length - 1) * 4)),
      supportingSamples: entry.scores.length,
      medianRouteDistanceMeters: distances[Math.floor(distances.length / 2)],
      evidence: [...entry.evidence, 'Multiple time-separated samples follow a plausible route trajectory'],
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return { status: 'NO_MATCH', candidates: [], explanation: 'No active bus candidate is consistently supported by the full movement sequence.' };
  const first = candidates[0], second = candidates[1];
  if (first.score >= 75 && (!second || first.score - second.score >= 15)) {
    return {
      status: 'CORROBORATED_CANDIDATE', selected: first, candidates: candidates.slice(0, 5),
      explanation: 'A bus candidate is supported by multiple consented movement samples. This is corroboration, not proof of physical vehicle identity; operator or independent fleet verification is still required.',
    };
  }
  return {
    status: 'AMBIGUOUS', candidates: candidates.slice(0, 5),
    explanation: 'The movement sequence supports multiple buses or lacks a clear confidence margin. Do not assign a unique bus identity.',
  };
}
