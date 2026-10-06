# analysis/: Phase 1 output (discovery, or product definition for a new app)

Produced by the `rn-analyze` playbook from `hybrid/`. See `guidelines/02-reading-react-native-source.md` §7.

| File | Written by |
|---|---|
| `inventory/inventory.json`, `inventory/INVENTORY.md` | `node tools/rn-inventory.mjs` (generated, don't edit) |
| `architecture.md` | analyst: analysed SHA, flavour, providers, state, networking, navigation tree |
| `feature-catalog.md` | analyst + product owner: feature IDs, routes, deps, priority, wave |
| `integrations.md` | analyst: every SDK/service and its native replacement |
| `data-at-rest.md` | analyst: every persisted key/table/file and its migration decision |
| `data-migration.md` | `plan-data-migration` playbook |
| `native-code.md` | analyst: custom native modules, config plugins, patches |
| `risks.md` | analyst + leads: ranked risks with owners |

## New app (`"mode": "new"`, guideline 15)

Produced by the `define-product` playbook from the product sources. There's no `inventory/`.

| File | Written by |
|---|---|
| `sources/README.md` | analyst: index of every source (ID, type, version, owner, location). Template `templates/sources-index.md` |
| `sources/workshop-<date>-<topic>.md` | agent during a workshop, confirmed by the product owner. Template `templates/workshop-notes.md` |
| `product-brief.md` | analyst + product owner: problem, users, journeys, first-release scope, quality targets |
| `feature-catalog.md` | analyst + product owner: feature IDs, journeys, sources, priority, wave, design/API readiness |
| `risks.md` | analyst + leads: ranked risks with owners |
| `HANDOFF.md` | the product handoff (template `templates/product-handoff.md`) |
