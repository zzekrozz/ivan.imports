# Platform shell and local vehicle storage

The internal shell uses `assets/academy/private/platform-navigation.js` as the source for the five global areas. Sidebars are contextual and derive Academy modules and tool categories from their canonical catalogs.

## Storage compatibility

The local key remains `ivanimports.academy.public-state.v2`. Its name is now historical technical debt: it stores platform and vehicle state as well as Academy progress. Renaming it would require a separate, versioned migration and is intentionally outside this release.

Legacy `state.candidates` entries migrate idempotently into `state.tools.adAnalyzer.vehicles`. The migration preserves an existing candidate ID, assigns a normalized `Vehicle.status`, and clears the parallel candidates array in the next saved snapshot. The legacy single-operation object is preserved for compatibility but is no longer the primary user interface.

Personal vehicle routes are `noindex` and use only the opaque internal vehicle ID. VINs, plates, seller data and notes must not be added to URLs, metadata, analytics or logs.
