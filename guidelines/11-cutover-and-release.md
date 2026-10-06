# 11 — Cut-over and release

> **New app** (no hybrid): there's no cut-over, data migration or OTA to retire. Launch is in guideline 15 § Phase 5; § Store
> identity and § Rollout below still apply.

The native apps ship as **an update to the existing store listings**. For users, it's just a new version of the
same app. They should notice nothing except that it's faster.

## Store identity (non-negotiable)

| | iOS | Android |
|---|---|---|
| Identifier | Same **bundle ID** as hybrid | Same **applicationId** as hybrid |
| Team / signing | Same Apple **Team ID** (Keychain access and app groups depend on it) | Same **app signing key**. With Play App Signing, Google holds it and you upload with your upload key. Without it, you need the original keystore |
| Version | Marketing version > current; `CFBundleVersion` > current build number | `versionCode` > the highest ever uploaded to **any** Play track (EAS remote versioning may have auto-incremented it; OTA updates don't change it); `versionName` > current |
| Entitlements | Same associated domains, keychain groups, app groups, push, Sign in with Apple | Same permissions/intent filters for links; same `android:sharedUserId` if one was ever set (rare; it can't be changed) |

For EAS-managed apps, download the credentials (`eas credentials`) during Phase 0 and store them in the team's
secret manager. Don't wait until release week.

## Platform not shipped yet

Sometimes the hybrid app was only ever published on one store. The giveaway is a template placeholder bundle ID such as
`org.reactjs.native.example.*`, which `rn-inventory` flags. In that case, for the platform that never shipped:
- it's a **new store listing**. Choose its bundle ID / applicationId in an ADR, since there's nothing to keep equal;
- there's **no upgrade path**: no upgrade-test track and no on-device data to migrate. Scope `CORE-LEGACY-MIGRATION` to the shipped
  platform (platform-scoped ACs, guideline 03) and add a **fresh-install onboarding** check on the new platform instead;
- store assets, privacy labels, review notes and the listing itself are new work. Plan them in Phase 4.
Record each platform's store status in `PROJECT.md` § Identity.

## Local data migration (the #1 cut-over risk)

When the native app first launches, the hybrid app's files are still in the sandbox. Anything the user expects
to keep (session, preferences, drafts, offline content) must be **read from the hybrid formats**.

Run the `plan-data-migration` playbook in Phase 1. It produces `analysis/data-migration.md`. Principles:

1. **Inventory everything** (`analysis/data-at-rest.md`): library, key/table, format, sensitivity, keep or drop.
2. **Read the library source for the exact version in `hybrid/package.json`.** Storage locations and formats
   change between major versions. Don't trust blog posts. Starting points (verify for your version):
   - `@react-native-async-storage/async-storage`: iOS writes files under Application Support
     (`RCTAsyncLocalStorage_V1/manifest.json`, with large values in separate files). Android uses a SQLite
     database (`RKStorage`, table `catalystLocalStorage`). Newer major versions changed the backend.
   - `expo-secure-store` / `react-native-keychain`: iOS Keychain items (check the service/account/access-group
     attributes the library uses). Android: values encrypted with Android Keystore keys and stored in
     SharedPreferences. The library's own Kotlin/Java code shows how to decrypt them, and it's already native code.
   - `react-native-mmkv`: MMKV files. The native MMKV SDKs can open the same instance ID and path.
   - SQLite / WatermelonDB / Realm / op-sqlite: open the same database file natively and write a schema adapter.
   - redux-persist / zustand `persist`: JSON blobs inside one of the stores above. Parse only the fields you need.
3. **Migrate once, idempotently, at launch, before the first screen**, behind a `LegacyDataMigrator` in a core module.
   Record `migrationVersion` in the new storage.
4. **Don't delete the legacy data for at least two releases.** If you have to ship a hybrid hotfix build, it
   still finds its data.
5. **The session is P0.** If the token can't be migrated, the user gets logged out. Decide explicitly whether that's
   acceptable. It usually isn't.
6. **Test the upgrade on two tracks.** Store-signed builds can't be sideloaded over each other, so one test isn't enough:
   - **Local fidelity test (automated, every build):** rebuild the *production hybrid commit* as a debuggable build with the
     same bundle ID / applicationId, signed with the same local key as the native debug build. Install it, log in, create
     data (a Maestro flow), then install the native build over it (`xcrun simctl install booted Native.app` keeps the data
     container; `adb install -r` works because the keys match). Run the migration assertions. This lives in `e2e/upgrade/`.
   - **Real-path test (before each beta and the release):** on real devices, install the **store** hybrid version, use it,
     then update through **TestFlight** (iOS) and **Play internal testing / internal app sharing** (Android, Play-signed).
     This is the only test that covers real Keychain/Keystore items, store signing and push tokens.

## Continuity checklist

- [ ] **Push:** the native app registers and sends the token to the backend the same way. The FCM/APNs setup and
      notification channel IDs are preserved. The payload → navigation mapping is covered by the deep-link table
- [ ] **Deep links / universal links / app links:** same schemes, same paths. AASA and `assetlinks.json` still valid
      (the Android SHA-256 fingerprint matches the signing key)
- [ ] **Analytics:** same SDK project, same event names. User ID/identity is kept after upgrade (read from legacy storage)
- [ ] **Crash reporting:** new releases are tagged so you can compare hybrid vs native crash-free rates
- [ ] **Remote config / flags:** same keys; native defaults equal hybrid defaults
- [ ] **Auth providers:** Sign in with Apple / Google / OAuth redirect URIs registered for the native bundle
- [ ] **In-app purchases / subscriptions:** same product IDs; restore purchases works; entitlements are server-side or migrated
- [ ] **Permissions:** usage-description strings present; already granted permissions stay granted (they're tied to the bundle, but test it)
- [ ] **Force-update mechanism:** exists in the native app before cut-over, so you can push users off broken builds
- [ ] **Privacy:** App Store privacy manifest / nutrition labels and Play Data safety updated to the native SDK set

## OTA updates end at cut-over

`expo-updates` has no native equivalent. After cut-over every change is a store release. So:
- ship the **last OTA** for the hybrid app before the native release, and freeze it;
- put runtime switches you'll need (kill switches, flags for risky features) in remote config *before* launch;
- plan for faster store releases (automated pipelines, phased releases, expedited review only in emergencies).

## Rollout

1. Internal: TestFlight internal + Play internal testing, installed **over** the store hybrid build.
2. Beta: TestFlight external + Play closed testing, for 1–2 weeks. Watch crash-free rate, login success and key funnels.
3. Production: App Store **phased release** (7-day automatic ramp, can be paused) + Play **staged rollout**
   (e.g. 1% → 5% → 20% → 50% → 100%). Release both platforms on the same day.
   **The two don't stop the same way.** Halting a Play staged rollout stops new users from getting the build. Pausing an
   App Store phased release only pauses *automatic* updates: new installs and manual updates still get the native
   build. On iOS, the real brakes are remote-config kill switches and a fast hotfix.
4. Kill criteria, written in advance: e.g. crash-free sessions < baseline − 0.5 pt, login failure > 2×
   baseline, or conversion on a P0 funnel down > X%. Action: halt the rollout (Android), pause the phased release
   (iOS, partial brake only), turn off the flag, ship a hotfix.
5. You can't roll back to hybrid. A "rollback" means shipping a *new* version. That's why the legacy data is kept
   (principle 4) and the hybrid repo stays buildable until a full release cycle after 100%.

## After cut-over

- Archive the hybrid repo (read-only) and keep it in the workspace as `hybrid/`. Specs still cite it.
- Remove the `LegacyDataMigrator` only after analytics show that almost no users upgrade from hybrid versions any more
  (record the threshold in an ADR).
- Switch the workspace to steady state (`12-long-term-maintenance.md`).
