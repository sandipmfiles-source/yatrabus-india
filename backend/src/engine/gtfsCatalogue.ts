export const PUBLIC_GTFS_SNAPSHOT_URL = 'https://github.com/sandipmfiles-source/yatrabus-india/releases/download/gtfs-latest/yatribus-gtfs-snapshot.tar.gz';
export const PUBLIC_GTFS_RELEASE_URL = 'https://github.com/sandipmfiles-source/yatrabus-india/releases/tag/gtfs-latest';

type GtfsFeed = {
  id: string; name: string; region: string; mode: string; status: string;
  official?: boolean; format?: string; sourcePage?: string | null;
  licenseUrl?: string | null; licenseReview?: string; catalogUrl?: string | null;
  attribution?: string | null; notes?: string;
};

export function buildPublicGtfsCatalogue(registry: { feeds?: GtfsFeed[] }) {
  const feeds = Array.isArray(registry.feeds) ? registry.feeds : [];
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    snapshot: {
      status: 'PUBLISHED_BY_DAILY_VALIDATION_WORKFLOW',
      downloadUrl: PUBLIC_GTFS_SNAPSHOT_URL,
      releaseUrl: PUBLIC_GTFS_RELEASE_URL,
      format: 'normalized-json-tar-gz',
      dataType: 'GTFS_STATIC',
      liveVehiclePositionsAvailable: false,
    },
    counts: { enabledFeeds: feeds.filter(feed => feed.status === 'enabled').length },
    feeds: feeds.filter(feed => feed.status === 'enabled').map(feed => ({
      id: feed.id,
      name: feed.name,
      region: feed.region,
      mode: feed.mode,
      sourceType: feed.official ? 'OFFICIAL_PUBLISHER' : 'COMMUNITY_DERIVED',
      timetableVerificationStatus: 'UNVERIFIED',
      sourcePage: feed.sourcePage || null,
      cataloguePage: feed.catalogUrl || null,
      licenceUrl: feed.licenseUrl || null,
      licenceReview: feed.licenseReview || 'REVIEW_REQUIRED',
      attribution: feed.attribution || null,
      notes: feed.notes || null,
      realtimeAvailable: false,
    })),
    dataPolicy: [
      'GTFS Static contains published schedules, not live GPS positions.',
      'Community-derived feeds are not operator-certified and remain UNVERIFIED.',
      'Service calendars and exceptions must be applied for the requested travel date.',
      'A feed being listed does not guarantee a bus operates on every date or that the source is current.',
    ],
  };
}
