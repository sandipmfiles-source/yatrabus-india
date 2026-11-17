import { buildPublicGtfsCatalogue, PUBLIC_GTFS_SNAPSHOT_URL } from '../../backend/src/engine/gtfsCatalogue.js';

export function runPublicGtfsCatalogueTests(assert: (description: string, pass: boolean) => void) {
  const result = buildPublicGtfsCatalogue({ feeds: [
    { id: 'official-feed', name: 'Official Feed', region: 'City A', mode: 'bus', status: 'enabled', official: true, sourcePage: 'https://example.gov/feed', licenseReview: 'reviewed', attribution: 'Agency' },
    { id: 'community-feed', name: 'Community Feed', region: 'City B', mode: 'bus', status: 'enabled', official: false, licenseReview: 'MIT-reviewed' },
    { id: 'disabled-feed', name: 'Disabled Feed', region: 'City C', mode: 'bus', status: 'disabled' },
  ] });
  assert('Public timetable catalogue exposes only enabled feeds', result.feeds.length === 2 && result.counts.enabledFeeds === 2);
  assert('Official publisher and community-derived provenance remain distinct', result.feeds[0].sourceType === 'OFFICIAL_PUBLISHER' && result.feeds[1].sourceType === 'COMMUNITY_DERIVED');
  assert('Every GTFS timetable remains explicitly unverified until operator verification', result.feeds.every(feed => feed.timetableVerificationStatus === 'UNVERIFIED'));
  assert('Static GTFS never claims live vehicle positions', result.snapshot.liveVehiclePositionsAvailable === false && result.feeds.every(feed => feed.realtimeAvailable === false));
  assert('Catalogue publishes a stable release download URL', result.snapshot.downloadUrl === PUBLIC_GTFS_SNAPSHOT_URL && result.snapshot.downloadUrl.includes('/releases/download/gtfs-latest/'));
  assert('Missing registry feeds safely returns an empty catalogue', buildPublicGtfsCatalogue({}).feeds.length === 0);
}
