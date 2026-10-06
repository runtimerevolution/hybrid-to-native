# {{ID}} — Parity review

- **Verdict:** PASS | PASS WITH NOTES | FAIL
- **Reviewed:** iOS `<sha>` · Android `<sha>` · spec hash `<hash>` · contract updated `<date>`
- **Reviewer:** parity-reviewer (behaviour & contract). Platform quality: `review-quality-ios.md`, `review-quality-android.md`

## AC coverage (from `node tools/parity-report.mjs --feature {{ID}}`)

<!-- paste table -->

## Findings

| # | Platform | Severity | Area | Finding | Evidence | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | ios / android / both | blocker / major / minor | contract / behaviour / a11y / strings / analytics / test / idiom | | `ios/…:NN` | |

Severity: **blocker**, a spec/contract violation or a missing AC test. **Major**, a user-visible difference
not listed in *Platform differences*. **Minor**, style, idiom or naming nits.

## Contract conformance

| Item | iOS | Android |
|---|---|---|
| UiState fields | ✅/❌ | ✅/❌ |
| Actions | | |
| Effects | | |
| Repository signatures | | |
| Test IDs | | |
| String keys | | |
| Analytics events and properties | | |

## Visual comparison

<!-- For each state with screenshots in assets/{hybrid,ios,android}/: missing/extra elements, wrong content, hierarchy. -->

## Unlisted platform differences found

<!-- Each one must be fixed or added to the spec's Platform differences (product owner decides). -->
