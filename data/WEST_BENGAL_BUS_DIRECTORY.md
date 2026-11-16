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
`data/west-bengal-bus-directory.json` is the source dataset. It must be connected to the existing place/transit loader and covered by schema and duplicate tests before it appears in passenger autocomplete. This data-only change does not claim frontend/backend integration.