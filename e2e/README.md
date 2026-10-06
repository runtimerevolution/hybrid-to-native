# e2e/: shared Maestro flows

The **same flow files** run against the hybrid app (Phase 1 golden reference), the iOS app and the Android app.
Rules: `guidelines/10-testing-and-parity.md`.

```
flows/<area>/<journey>.yaml     # one journey per file, "# AC: <ID>-ACnn" comment for each AC it covers
subflows/*.yaml                 # reusable steps (launch clean, log in, …)
analytics/<flow>.expected.jsonl # event stream captured from the hybrid app for tools/analytics-diff.mjs
golden/<platform>/<flow>/       # screenshots + analytics of the hybrid recording (see golden/README.md)
upgrade/                        # install-hybrid-then-native upgrade tests (data migration)
```

```bash
maestro test -e APP_ID=<bundle id / applicationId> e2e                  # pass the e2e folder: config.yaml selects flows/**
maestro test -e APP_ID=<id> --include-tags=smoke e2e
maestro test -e APP_ID=<id> --format junit --output e2e/results/ios.xml e2e   # results for parity-report --e2e-results
```

- Select elements by `id` only (test IDs from each feature's `contract.md`).
- Platform-specific steps go in a small subflow with `runFlow: when: platform: iOS|Android`.
- Golden-reference runs against the hybrid app use its `migration/test-hooks` branch (test IDs + analytics sink only).
- Flows that need an account or data the team doesn't have yet are tagged `needs-account` and listed in `golden/README.md`.
  Skip them in runs with `--exclude-tags=needs-account` until access exists.
- `e2e/results/` holds JUnit output. Don't commit it; CI produces it.
