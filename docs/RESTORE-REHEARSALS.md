# Restore rehearsals

One row per `pnpm --filter @workspace/api-server ops:rehearse` run (Phase 98). A backup nobody has restored is not a backup: go/no-go 1.2 and Phase 99 L-2 are closed by a `pass` row here, and `ops:owner-check` reads this file. Rehearse again after any large migration and at least every quarter.

| Date | Result | Backup | Target project | Tables / rows | Backup time | Restore time | Note |
|---|---|---|---|---|---|---|---|
