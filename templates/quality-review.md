# {{ID}} — <iOS|Android> platform quality review

- **Verdict:** PASS | PASS WITH NOTES | FAIL
- **Reviewed:** `<ios|android>` branch `feature/{{ID}}` @ `<sha>` against `<default branch>`
- **Skills applied:** <!-- e.g. swiftui-expert @ 9808b06 (with guideline 14 §4 overrides) -->

## Findings

| # | Severity | Area | Finding | Evidence | Rule | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | blocker / major / minor | kit-pattern / performance / a11y / concurrency / adaptive / security / idiom | | `path:line` | guideline 06 § … / skill reference … | |

Severity: **blocker**, a crash/leak/security issue, an inaccessible control, or a kit rule that breaks parity or
correctness (wrong state pattern, missing test IDs, hand-edited generated code). **Major**, a noticeable performance,
accessibility or adaptive-layout problem, or another kit-rule violation. **Minor**, an idiom or style issue.

Verdict: **FAIL** if any blocker. **PASS WITH NOTES** if majors only: they're fixed in the fix loop, and no spec change
or product-owner approval is needed. **PASS** if only minors, which become follow-up tickets and don't block the merge.

## Skill advice deliberately not applied

<!-- Where a skill suggested something the kit overrides (guideline 14 §4). List it so nobody "fixes" it later. -->
