import type { Route } from '../../packages/shared/src/types/bus.js';
import { planJourneys } from '../../packages/shared/src/engine/journeyPlanner.js';

const days: Route['operatingDays'] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
function makeRoute(id: string, number: string, names: string[], times: Array<{ dep: string; arr: string; depOffset?: number; arrOffset?: number }>): Route {
  const stops = names.map((name, index) => ({
    id: id + '-s' + index, routeId: id, stopId: id + '-p' + index, stopName: name,
    stopSequence: index + 1, latitude: 22.3 + index * 0.01, longitude: 87.2 + index * 0.01,
    distanceFromStartKm: index * 5,
  }));
  return {
    id, routeNumber: number, routeName: names.join(' to '),
    originStopId: stops[0].stopId, originStopName: names[0],
    destinationStopId: stops[stops.length - 1].stopId, destinationStopName: names[names.length - 1],
    operatorId: 'op', direction: 'UP', distanceKm: (names.length - 1) * 5,
    typicalDurationMinutes: (names.length - 1) * 20, operatingDays: days,
    firstDepartureTime: times[0].dep, lastDepartureTime: times[times.length - 1].dep,
    departures: times.map((time, index) => ({
      id: id + '-d' + index, timetableId: id, departureTime: time.dep, arrivalTime: time.arr,
      departureDayOffset: time.depOffset || 0,
      stopTimes: [
        { stopId: stops[0].stopId, departureTime: time.dep, departureDayOffset: time.depOffset || 0 },
        { stopId: stops[stops.length - 1].stopId, arrivalTime: time.arr, arrivalDayOffset: time.arrOffset || 0 },
      ],
      operatingDays: days, confidenceScore: 90, isCancelled: false,
    })),
    stops, verificationStatus: 'ADMIN_VERIFIED', serviceStatus: 'OPERATING_SCHEDULED',
    createdAt: '', updatedAt: '',
  };
}

export function runJourneyPlannerTests(assert: (description: string, pass: boolean) => void) {
  const routes = [
    makeRoute('r1', '1', ['Kharagpur', 'Midpoint'], [{ dep: '23:30', arr: '23:55' }]),
    makeRoute('r2', '2', ['Midpoint', 'Town C'], [{ dep: '00:10', arr: '00:40', depOffset: 1, arrOffset: 1 }]),
    makeRoute('r3', '3', ['Town C', 'Jhargram'], [{ dep: '00:55', arr: '01:30', depOffset: 1, arrOffset: 1 }]),
  ];
  const result = planJourneys('Kharagpur', 'Jhargram', routes, {
    currentTimeIso: '2026-11-02T17:00:00.000Z', minimumTransferMinutes: 8, maximumTransferWaitMinutes: 90,
  });
  assert('Planner discovers a journey with two transfers', result.transferRoutes.some(item => item.transfers.length === 2));
  const multi = result.transferRoutes.find(item => item.transfers.length === 2);
  assert('Multi-transfer result retains all three ordered legs', multi?.legs?.length === 3);
  assert('Planner handles a connection crossing midnight', multi?.departureTime === '23:30' && multi?.arrivalTime === '01:30' && multi.durationMinutes === 120);
  assert('Planner labels the final arrival as the next IST calendar day', multi?.arrivalNextDay === true && multi?.legs?.[2]?.arrivalNextDay === true);
  assert('Each transfer wait respects the minimum buffer', multi?.transfers.every(item => item.expectedWaitMinutes >= 8) === true);

  const missed = planJourneys('Kharagpur', 'Jhargram', [
    routes[0], makeRoute('r2-late', '2', ['Midpoint', 'Town C'], [{ dep: '01:30', arr: '02:00', depOffset: 1, arrOffset: 1 }]), routes[2],
  ], { currentTimeIso: '2026-11-02T17:00:00.000Z', maximumTransferWaitMinutes: 90 });
  assert('Planner rejects a missed connection outside the transfer wait window', missed.transferRoutes.length === 0);
}
