/**
 * GTFS (General Transit Feed Specification) Static Ingestion Parser
 * Converts GTFS stops.txt, routes.txt, and stop_times.txt into YatriBus schema.
 */

import { Route, RouteStop } from '../../packages/shared/src/types/bus.js';

export interface GTFSStopRecord {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
}

export interface GTFSRouteRecord {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  agency_id: string;
}

export interface GTFSStopTimeRecord {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
}

export function convertGTFSToYatriBus(
  gtfsRoutes: GTFSRouteRecord[],
  gtfsStops: GTFSStopRecord[],
  gtfsStopTimes: GTFSStopTimeRecord[],
  operatorId: string,
  sourceDataset: string
): Route[] {
  const stopMap = new Map<string, GTFSStopRecord>();
  for (const s of gtfsStops) {
    stopMap.set(s.stop_id, s);
  }

  const routes: Route[] = [];

  for (const r of gtfsRoutes) {
    // Find stops associated with route
    const associatedStops: RouteStop[] = [];
    const times = gtfsStopTimes.filter(t => t.trip_id.startsWith(r.route_id));

    times.sort((a, b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10));

    let seq = 1;
    for (const t of times) {
      const stopInfo = stopMap.get(t.stop_id);
      if (stopInfo) {
        associatedStops.push({
          id: `rs-gtfs-${r.route_id}-${seq}`,
          routeId: `route-${r.route_id}`,
          stopId: stopInfo.stop_id,
          stopName: stopInfo.stop_name,
          stopSequence: seq,
          latitude: parseFloat(stopInfo.stop_lat),
          longitude: parseFloat(stopInfo.stop_lon),
          distanceFromStartKm: (seq - 1) * 2.5,
          scheduledArrivalTime: t.arrival_time.substring(0, 5),
          scheduledDepartureTime: t.departure_time.substring(0, 5),
        });
        seq++;
      }
    }

    if (associatedStops.length >= 2) {
      routes.push({
        id: `route-${r.route_id}`,
        routeNumber: r.route_short_name || r.route_id,
        routeName: r.route_long_name || `Route ${r.route_short_name}`,
        originStopId: associatedStops[0].stopId,
        originStopName: associatedStops[0].stopName,
        destinationStopId: associatedStops[associatedStops.length - 1].stopId,
        destinationStopName: associatedStops[associatedStops.length - 1].stopName,
        operatorId,
        direction: 'UP',
        distanceKm: (associatedStops.length - 1) * 2.5,
        typicalDurationMinutes: Math.round((associatedStops.length - 1) * 6),
        operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        firstDepartureTime: '06:00',
        lastDepartureTime: '22:00',
        frequencyMinutes: 20,
        stops: associatedStops,
        verificationStatus: 'COMMUNITY_CORROBORATED',
        serviceStatus: 'OPERATING_SCHEDULED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return routes;
}
