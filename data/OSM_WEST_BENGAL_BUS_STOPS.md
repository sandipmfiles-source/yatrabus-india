# West Bengal OpenStreetMap bus-stop seed

This small seed contains nine mapped bus stations/stops in Kolkata, Howrah, Jhargram and Midnapore. It is intended to provide an offline fallback for Nearby Bus Stops when public Overpass endpoints are rate-limited.

## Licence and attribution

The extracted OpenStreetMap-derived database subset is made available under the [Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).

**Attribution:** © OpenStreetMap contributors. The source OSM node/way ID, direct object URL, Mapcarta reference page, and OSM tags are retained in `data/osm-west-bengal-bus-stops.json` and the D1 payload.

## Data quality

- These are mapped locations, not proof that a bus is currently operating there.
- `busServiceVerified` is false and `operationalStatus` is `UNKNOWN` for every row.
- No route, departure time, frequency, fare, or live status is inferred.
- Coordinates are map-derived and have not been physically field-verified.
- The seed is deliberately small and is not a complete West Bengal or India stop inventory.
- New additions must preserve OSM attribution, ODbL licensing, stable OSM IDs, and source tags.

## Source data

The machine-readable source-of-truth file is `data/osm-west-bengal-bus-stops.json`. Migration `0007_osm_west_bengal_bus_stops.sql` loads the same records into Cloudflare D1 with `INSERT OR IGNORE`.
