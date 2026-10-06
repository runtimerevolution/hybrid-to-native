# specs/

Slices (`specs/slices/<SLICE-ID>.md`, template `templates/slice.md`) group features into a tappable build unit for `/implement-slice`.

One folder per feature: `specs/features/<FEATURE-ID>/` with `spec.md`, `contract.md`, `impl-ios.md`,
`impl-android.md`, `review.md` and `assets/{hybrid,ios,android}/`.

- Create: `node tools/spec.mjs new <FEATURE-ID> "<title>"`, then `/spec-feature <FEATURE-ID>`
- Approve: `node tools/spec.mjs approve <FEATURE-ID> --by "<name>"` (records a content hash), or a whole slice with `--slice <SLICE-ID>`
- Wording-only edit after approval: `node tools/spec.mjs amend <FEATURE-ID> --editorial "<reason>" --by "<who>"`
- Status overview: `node tools/spec.mjs list` and `parity/STATUS.md`

Rules: `guidelines/03-feature-specs.md`. Workflow: `guidelines/04-parallel-agent-workflow.md`.
