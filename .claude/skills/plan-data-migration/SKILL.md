---
name: plan-data-migration
description: 'Design how the native iOS and Android apps will read the data the React Native / Expo app left on the device (AsyncStorage, SecureStore/Keychain, MMKV, SQLite, redux-persist, files), so users stay logged in and keep their data after the upgrade. Produces analysis/data-migration.md and the CORE-LEGACY-MIGRATION spec. Use in Phase 1, or whenever a persisted value is added or changed.'
---

# plan-data-migration: nothing lost on upgrade

Background: `guidelines/11-cutover-and-release.md` § Local data migration. The native app installs **over** the
hybrid app (same bundle ID / applicationId), so the hybrid files, database and keychain entries are still there at first launch.

## Steps

1. **Inventory.** Start from `analysis/inventory/INVENTORY.md` § Data at rest and `analysis/data-at-rest.md`.
   Resolve every non-literal key: follow the constant/expression to its value. Search for storage the scanner can
   miss: custom wrappers, `redux-persist` / `zustand persist` configs, cache libraries, the React Query persister,
   `expo-file-system` paths, WebView cookies/localStorage, native modules that write to disk.

2. **Pin the exact on-disk format for each library.** Read the library source **for the exact version installed**
   (`node_modules/<lib>/package.json` in the app folder, or hoisted up to the repo root in a monorepo; iOS/Android
   sources inside the package). **No `node_modules`?** Take the exact version from the lockfile (the inventory's *Locked*
   column) and read the library's source at that tag upstream. Mark each format **inferred**, and add a Phase 2 task to confirm it
   (install in a scratch copy, plus fixture capture). Reading another local checkout of the same repo needs the user's explicit OK.
   It's read-only, and you record its path and SHA. Document for each
   one: location (directory, DB name, keychain service/account/access group, SharedPreferences file), encoding
   (JSON? base64? encrypted how?), key naming (prefixes, namespaces). Don't rely on blog posts. Formats change
   between major versions.

3. **Classify each item** in `analysis/data-at-rest.md`:

   | Item | Library / location | Sensitivity | Needed after upgrade? | Action | Owner feature |
   |---|---|---|---|---|---|
   | session token | expo-secure-store `session_token` | secret | yes (P0) | migrate to Keychain / Keystore | CORE-SESSION |
   | onboarding_done | AsyncStorage | low | yes | migrate to UserDefaults / DataStore | ONBOARDING |
   | query cache | React Query persister | low | no | drop (refetch) | — |

4. **Design the migrator** (`analysis/data-migration.md`), the same on both platforms:
   - `LegacyDataMigrator` in a core module, run once at launch **before** the first screen, idempotent,
     guarded by `migrationVersion` in the new storage, and fast (measure it; it runs on the critical path).
   - Per item: read legacy → transform → write new → verify. **Never delete legacy data** (keep it for at least 2 releases).
   - Failure handling per item: skip-and-log for non-critical items. For the session: fall back to a clean login
     only if the product owner accepted that.
   - Where the library's native read code is reusable (keychain/keystore decryption, MMKV), port that code rather than
     re-implementing the format.
   - Telemetry: send one event with the migration outcome per item class (no values), so you can watch it during rollout.
     **No analytics SDK in the app?** Use the crash-reporting SDK (a custom key or a non-fatal event with the outcome).
     If there's none, write a local log that support can request. Decide which in the vendor ADR (ADR-0014) and the handoff.
   - **Platform never shipped** (guideline 11 § Platform not shipped yet): the migrator has nothing to read there. Scope
     its ACs to the shipped platform (`_Platforms: android_`) and add a fresh-install check on the other.

5. **Write the spec** `CORE-LEGACY-MIGRATION` (`node tools/spec.mjs new CORE-LEGACY-MIGRATION "Migrate hybrid data on first launch"`),
   with one AC per migrated item plus ACs for idempotency, partial failure and "fresh install (no legacy data)".
   Test level: `unit` with fixture files captured from a real device, plus an upgrade test in `e2e/upgrade/`.

6. **Capture fixtures.** Rebuild the *production hybrid commit* as a debuggable build (same bundle ID / applicationId).
   On a simulator/emulator, log in and create data, then copy the raw files and databases out
   (`xcrun simctl get_app_container booted <bundle id> data`; `adb exec-out run-as <package> …` only works on debuggable builds).
   Store sanitised copies under `contracts/fixtures/legacy/` for the migrator's unit tests. Keychain/Keystore items
   can't be copied, so the two upgrade-test tracks in guideline 11 (local fidelity + TestFlight / Play internal testing) have to cover them.

7. **Report** the items, the actions, the risks (anything that can't be migrated) and the decisions the product owner
   needs to make.
