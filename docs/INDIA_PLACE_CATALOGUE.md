# India-wide administrative place catalogue

## What this data import covers

YatriBus currently ships a small administrative seed (the 28 States and 8 Union Territories, plus their capital suggestions). That is not a town/village directory.

This import adds the Local Government Directory (LGD) hierarchy to PostgreSQL:

- State / Union Territory
- District
- Sub-district (tehsil, taluka, mandal or equivalent)
- Revenue village

The public dataset listing checked for this implementation reports 676,891 village rows, 781 district codes and 7,073 sub-district codes in its July 2026 export. The Ministry of Panchayati Raj's LGD is the authoritative source and is updated as administrative entities change. Do not treat this export as a permanent snapshot.

Sources:
- [Ministry of Panchayati Raj — LGD](https://panchayat.gov.in/en/lgd/)
- [Open Government Data — LGD catalogue](https://data.gov.in/catalog/local-government-directory-lgd)
- [LGD village hierarchy export (Dataful mirror of LGD source)](https://dataful.in/datasets/21838/)

## Download and import

1. Download the latest all-India LGD export with the eight columns below from the official LGD download directory or the linked dataset mirror.
2. Save it as `data/lgd_places.csv` in the repository root. Keep the header row.
3. Confirm the columns are in this order:

   `state_code,state_name,district_code,district_name,sub-district_code,sub-district_name,village_code,village_name`

4. Run:

   ```bash
   psql "$DATABASE_URL" -f backend/migrations/005_lgd_place_catalogue.sql
   ```

The migration uses LGD codes as stable IDs and is safe to rerun. It marks imported places `UNVERIFIED`; a place directory entry does not prove that a bus service operates there.

## Important coverage boundary

LGD revenue-village exports do not by themselves provide a complete, current urban town/city directory or every named locality, neighbourhood, bus stand and stop. Census 2011 town directories can supplement statutory/census towns, but they are older and need reconciliation against current municipal records. Add that as a separately sourced dataset; do not silently label 2011 town names as current.

This migration targets the PostgreSQL `places` table. The current Express runtime still uses its in-process repository and JSON-file persistence; the PostgreSQL adapter and migration runner must be connected before these imported rows become searchable in the live APK. Do not claim nationwide search coverage until that runtime integration and import have been verified.

## Licensing and attribution

The OGD catalogue identifies the LGD datasets as Government of India open-government data. Preserve source name, source record code and licence metadata in every imported row. Re-check the current source page's reuse terms before redistributing a refreshed export.
