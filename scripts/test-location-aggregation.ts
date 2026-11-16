import assert from "node:assert/strict";
import { aggregateBusLocation, type RawLocationObservation } from "../functions/_lib/locationAggregation";

const now = Date.parse("2026-11-16T10:00:00.000Z");
const observation = (session_id: string, latitude: number, longitude: number, secondsAgo = 5, accuracy = 25): RawLocationObservation => ({
  id: session_id,
  session_id,
  bus_id: "BUS-1",
  route_id: "ROUTE-1",
  latitude,
  longitude,
  accuracy,
  speed: 32,
  heading: 90,
  observed_at: new Date(now - secondsAgo * 1000).toISOString()
});

const single = aggregateBusLocation(
  [observation("S1", 22.300123, 70.800123)],
  "BUS-1",
  "ROUTE-1",
  [[22.3, 70.8], [22.31, 70.81]],
  now
);
assert.ok(single);
assert.equal(single.trackingStatus, "estimated");
assert.equal(single.confidence, "low");
assert.equal(single.contributorCount, 1);
assert.equal(single.isCorroborated, false);
assert.equal(single.latitude, 22.3, "single-source public position must be rounded");

const corroborated = aggregateBusLocation(
  [
    observation("S1", 22.30010, 70.80010, 5, 20),
    observation("S2", 22.30020, 70.80020, 8, 30)
  ],
  "BUS-1",
  "ROUTE-1",
  [[22.3, 70.8], [22.31, 70.81]],
  now
);
assert.ok(corroborated);
assert.equal(corroborated.trackingStatus, "live_gps");
assert.equal(corroborated.confidence, "high");
assert.equal(corroborated.contributorCount, 2);
assert.equal(corroborated.isCorroborated, true);

const disagreement = aggregateBusLocation(
  [
    observation("S1", 22.30, 70.80, 5, 20),
    observation("S2", 22.34, 70.84, 5, 20)
  ],
  "BUS-1",
  "ROUTE-1",
  [],
  now
);
assert.ok(disagreement);
assert.equal(disagreement.trackingStatus, "estimated");
assert.equal(disagreement.isCorroborated, false);

const stale = aggregateBusLocation(
  [observation("S1", 22.30, 70.80, 121)],
  "BUS-1",
  "ROUTE-1",
  [],
  now
);
assert.equal(stale, null, "stale observations must not appear on the live map");

const duplicateSession = aggregateBusLocation(
  [
    observation("S1", 22.30010, 70.80010, 20, 20),
    observation("S1", 22.30015, 70.80015, 5, 20),
    observation("S2", 22.30020, 70.80020, 8, 30)
  ],
  "BUS-1",
  "ROUTE-1",
  [],
  now
);
assert.ok(duplicateSession);
assert.equal(duplicateSession.contributorCount, 2, "one device/session must count only once");
assert.equal(duplicateSession.trackingStatus, "live_gps");

const outsideIndia = aggregateBusLocation(
  [observation("S1", 40.0, 70.8)],
  "BUS-1",
  "ROUTE-1",
  [],
  now
);
assert.equal(outsideIndia, null);

console.log("Location aggregation tests passed: yellow single-source estimate, green independent corroboration, stale/outlier filtering and session de-duplication.");
