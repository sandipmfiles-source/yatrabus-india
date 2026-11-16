# West Bengal Bus Directory

This dataset adds a source-attributed West Bengal bus directory to YatraBus India.

## Contents
- Five government directory/operator references with current/legacy validation labels
- Depot names listed by the state transport directory
- District-wise bus terminals with Bengali aliases
- Source URLs and explicit verification states

## Data-quality rules
- The West Bengal Transport Department terminal page says it was last updated **3 March 2017**. Its terminal names are historical references, not confirmation of current operation.
- Proposed terminals remain marked `PROPOSED_IN_SOURCE`.
- No coordinates, route numbers, fares, departure times, or live status have been invented.
- Every depot and terminal has `operationalStatus: UNKNOWN` until a current source or human verifier confirms it.
- CSTC and WBSTC are retained as government-directory references; their separate current operating status requires validation.

## Sources
- [West Bengal Transport Department — Bus Depots & Terminals](https://transport.wb.gov.in/infrastructure/bus-depots-terminals/)
- [WBTIDCL — Bus Depots & Terminals](https://wbtidcl.com/services/bus-depots-terminals/)
- [West Bengal Transport Department](https://transport.wb.gov.in/)
- [WBTC official booking and route portal](https://wbtconline.in/home)

## Integration note
`data/west-bengal-bus-directory.json` is imported by `backend/src/db/indiaAdminAreas.ts` and converted into shared `Place` records used by `repository.searchPlaces()`. The public `/api/places/search` endpoint therefore includes the imported terminal candidates, and `/api/india/catalogue` reports the expanded West Bengal terminal index. Proposed-only records are excluded from passenger autocomplete. The automated India catalogue test suite checks the import, source provenance, Bengali aliases, unverified state, and absence of invented coordinates. These are historical terminal references; the 2017 source date remains visible and they are not proof of active bus service.