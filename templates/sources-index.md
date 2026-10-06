# Product sources

The evidence specs cite in a new app (guideline 15 § Product sources). Every PRD, brief, design file, workshop and piece of
research that defines behaviour gets a row with a **stable ID**. Specs cite these IDs (`prd:§3.2`, `figma:12:345`,
`workshop:2026-10-02#D03`), never "the doc" or "the designs".

- Store a copy (Markdown or PDF export) in this folder when you're allowed to, or link to it. No secrets, credentials
  or personal data. Workshop notes use roles, not people's names, unless the team agrees otherwise.
- **A new version of a source is a change:** add a row (or bump the version), then list the affected specs under
  *Re-check*. Approved specs that cite the old version get a spec change (guideline 03).
- When two sources disagree, the product owner decides. Record the decision in a workshop note and cite it.

| ID | Type | Title | Version / date | Owner (role) | File or link | Re-check |
|---|---|---|---|---|---|---|
| prd | prd | <!-- e.g. Product requirements v1 --> | <!-- v1.0, 2026-10-01 --> | product owner | <!-- prd-v1.md or URL --> | |
| figma | figma | <!-- design file name --> | <!-- version / last edited date --> | designer | <!-- Figma URL (file key) --> | |
| <!-- workshop:2026-10-02 --> | workshop | <!-- topic --> | <!-- date --> | product owner | <!-- workshop-2026-10-02-topic.md --> | |
