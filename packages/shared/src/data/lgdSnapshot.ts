/** Latest supplemental LGD export imported into the runtime index. Source data is not human-verified bus-stop data. */
export const LGD_INDEX_METADATA = {
  snapshotDate: '2026-11-02',
  sourceUrl: 'https://lgdirectory.gov.in/',
  sourceRepository: 'https://github.com/ramSeraph/opendata/releases/tag/lgd-latest',
  license: 'Government Open Data License - India (GODL-India)',
  statesAndUnionTerritories: 35,
  districts: 787,
  subdistricts: 7089,
  blocks: 7327,
  urbanLocalBodies: 5050,
  totalRecords: 20288,
};

/** Older split index retained as a fallback if the supplemental archive is unavailable. */
export const LGD_BASELINE_METADATA = {
  snapshotDate: '2022-03-11',
  sourceUrl: 'https://lgdirectory.gov.in/',
  sourceRepository: 'https://github.com/planemad/india-local-government-directory',
  license: 'Government Open Data License - India (GODL-India)',
  statesAndUnionTerritories: 36,
  districts: 763,
  subdistricts: 6921,
  blocks: 1673,
  urbanLocalBodies: 4814,
  totalRecords: 14207,
};
