# 09 — React Native / Expo → native mapping

How RN concepts and libraries translate to SwiftUI and Compose. Two parts: **concept mapping** (how to
rethink the code) and **library mapping** (what replaces each dependency).

## Concept mapping

| React Native | iOS (SwiftUI) | Android (Compose) | Watch out for |
|---|---|---|---|
| Function component | `View` struct | `@Composable` function | Don't split views as finely as React components. Extract when it helps reuse or readability |
| Props | Initialiser parameters | Function parameters | Pass `state` + `onAction`, not ten separate callbacks |
| `useState` (UI-local) | `@State` | `remember { mutableStateOf() }` / `rememberSaveable` | Anything that must survive process death (Android) → `SavedStateHandle` |
| `useState`/`useReducer` (screen logic) | View model `state` | View model `StateFlow` | Business logic moves out of the view |
| `useEffect(() => …, [])` on mount | `.task { }` | `LaunchedEffect(Unit) { }` | `.task` is cancelled on disappear. Long work belongs in the view model |
| `useEffect` on dependency change | `.task(id:)` / `.onChange(of:)` | `LaunchedEffect(key)` | Effect chains usually mean the state model is wrong |
| `useFocusEffect` | `.onAppear` / `.task` on the destination | `LifecycleResumeEffect` / `repeatOnLifecycle(RESUMED)` | Refresh-on-focus is a spec rule. Write it down |
| `useMemo` / `useCallback` | Computed properties; usually unnecessary | `remember(key)` / `derivedStateOf` | |
| Context provider | `@Environment` / injected dependency | `CompositionLocal` (UI only) / Hilt (services) | Don't use `CompositionLocal` for services |
| Redux/Zustand global store | Repositories (shared data) + view models (screen state) | Same | Global mutable state is the most common port smell |
| React Query / RTK Query | Repository with cache | Repository with `Flow` + cache | Spec the caching behaviour explicitly |
| `StyleSheet` / Tailwind classes | View modifiers + `DesignSystem` tokens | `Modifier` + design-system tokens | No inline magic numbers |
| Flexbox | `VStack`/`HStack`/`ZStack`, `Grid`, `ViewThatFits`, `Layout` | `Column`/`Row`/`Box`, `FlowRow`, `ConstraintLayout` | Flex `gap` ↔ stack `spacing` / `Arrangement.spacedBy` |
| `FlatList` / `FlashList` | `List` / `LazyVStack` in `ScrollView` | `LazyColumn` with stable `key` | Pagination and pull-to-refresh are spec items |
| `ScrollView` | `ScrollView` | `Column(Modifier.verticalScroll(rememberScrollState()))` | |
| `TextInput` | `TextField` / `SecureField` + `@FocusState` | `TextField`/`OutlinedTextField` + `FocusRequester` | Keyboard type, autofill (`textContentType` / `autofill`), return key are spec items |
| `Pressable`/`TouchableOpacity` | `Button` with custom `ButtonStyle` | `Button` / `Modifier.clickable` | Accessibility role comes for free with `Button` |
| `Modal` | `.sheet` / `.fullScreenCover` | `Dialog` / `ModalBottomSheet` | |
| `Alert.alert` | `.alert` / `.confirmationDialog` | `AlertDialog` | |
| `ActivityIndicator` | `ProgressView` | `CircularProgressIndicator` | |
| `Image` (remote) | `AsyncImage` / Nuke | Coil `AsyncImage` | |
| `Animated` / Reanimated | `withAnimation`, `PhaseAnimator`, transitions | `animate*AsState`, `AnimatedVisibility`, `updateTransition` | Rebuild the intent. Don't port worklets |
| `Platform.OS` branches | — | — | Each branch = a *Platform difference* in the spec |
| `AppState` listener | `scenePhase` | `ProcessLifecycleOwner` / `LifecycleEventObserver` | |
| `Linking` / deep links | `onOpenURL`, universal links | Intent filters, App Links | Parse via the shared deep-link table |
| `testID` | `.accessibilityIdentifier` | `Modifier.testTag` + `testTagsAsResourceId` | Keep identical values |
| `accessibilityLabel` / `Role` / `Hint` | `.accessibilityLabel` / traits / `.accessibilityHint` | `contentDescription` / `semantics { role }` | |
| Error boundary | Top-level error state + crash reporting | Same | |
| Metro env (`__DEV__`) | `#if DEBUG` | `BuildConfig.DEBUG` | AGP 8+: enable `buildFeatures { buildConfig = true }` |

## Library mapping

Generated from `tools/data/rn-library-map.json`. **Edit the JSON, not this table**, then regenerate this section with
`node tools/rn-inventory.mjs --print-map`. The inventory uses the same file to classify each dependency of the hybrid app.
Anything the inventory reports as `unmapped` needs a decision. Add it to the JSON when you've made one.

### navigation

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-router` | NavigationStack(path:) + route enum; TabView | Navigation 3 (or type-safe Navigation Compose) | medium | File tree under app/ is the route table; +api routes are server-only |
| `@react-navigation/*` | NavigationStack / TabView / sheets | Navigation 3 / Navigation Compose; NavigationBar; ModalNavigationDrawer | medium | The linking config is the deep-link table: copy it to contracts/deeplinks.md |
| `react-native-screens` | built in | built in | low | Infrastructure only |

### layout

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-safe-area-context` | SwiftUI safe areas (built in) | WindowInsets + enableEdgeToEdge() | low |  |
| `react-native-keyboard-controller` | Built-in keyboard avoidance; scrollDismissesKeyboard | imePadding() / WindowInsets.ime | low |  |
| `react-native-keyboard-aware-scroll-view` | Built-in keyboard avoidance | imePadding() | low |  |

### state

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@reduxjs/toolkit` | @Observable view models + repositories | ViewModel + StateFlow + repositories | medium | Split the global store: server data -> repositories, UI state -> view models. RTK Query endpoints feed contracts/openapi |
| `redux` | @Observable view models + repositories | ViewModel + StateFlow + repositories | medium | Reducers are a good source of business rules and test vectors |
| `react-redux` | n/a | n/a | low |  |
| `zustand` | @Observable view models + repositories | ViewModel + StateFlow + repositories | medium | Check for persist() middleware: that is data at rest |
| `mobx` | @Observable (closest mental model) | StateFlow / Compose state | medium |  |
| `mobx-state-tree` | @Observable + value models | StateFlow + data classes | medium | Snapshots may be persisted: check storage |
| `jotai` | @Observable | StateFlow | low |  |
| `recoil` | @Observable | StateFlow | low |  |

### storage

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `redux-persist` | Read legacy blob in LegacyDataMigrator | Read legacy blob in LegacyDataMigrator | high | Persisted JSON inside AsyncStorage/MMKV: list persisted slices in analysis/data-at-rest.md |
| `@react-native-async-storage/async-storage` | UserDefaults (non-sensitive) | DataStore (Preferences) | high | Legacy data must be migrated on first native launch. Storage format depends on the major version |
| `react-native-mmkv` | MMKV iOS SDK (reads same files) or UserDefaults | MMKV Android SDK (reads same files) or DataStore | high | Note instance IDs and encryption keys used |

### server-state

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@tanstack/react-query` | Repository with cache + async/await | Repository exposing Flow, Room/in-memory cache | medium | Record staleTime, retry, refetchOnFocus/Reconnect, optimistic updates in the spec: users notice these |
| `react-query` | Repository with cache | Repository with Flow | medium | Legacy v3 package name |
| `swr` | Repository with cache | Repository with Flow | medium |  |

### networking

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@apollo/client` | Apollo iOS | Apollo Kotlin | medium | Reuse .graphql operations and schema; normalized cache policies go in the spec |
| `axios` | URLSession + swift-openapi-generator client | Retrofit/OkHttp or Ktor + generated client | medium | Interceptors (auth, refresh, headers, retry) -> middleware / OkHttp Authenticator |

### secure-storage

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-secure-store` | Keychain Services | Android Keystore (+ Tink) | high | Session tokens usually live here. Port the library's decrypt logic for migration |
| `react-native-keychain` | Keychain Services | Android Keystore (+ Tink) | high | Check service names, access groups, accessibility and biometric flags |
| `react-native-encrypted-storage` | Keychain Services | Android Keystore (+ Tink) | high | Android side used EncryptedSharedPreferences (deprecated) |

### database

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-sqlite` | GRDB / SwiftData / SQLite | Room | high | Open the same DB file for migration; replicate schema migrations |
| `@op-engineering/op-sqlite` | GRDB / SQLite | Room / SQLite | high |  |
| `react-native-sqlite-storage` | GRDB / SQLite | Room / SQLite | high |  |
| `react-native-quick-sqlite` | GRDB / SQLite | Room / SQLite | high |  |
| `@nozbe/watermelondb` | GRDB / SwiftData | Room | high | SQLite underneath: open it natively; sync protocol must be re-implemented |
| `realm` | Realm Swift (or migrate to SwiftData/GRDB) | Realm Kotlin (or migrate to Room) | high | MongoDB deprecated Atlas Device Sync/SDKs: prefer migrating off |
| `@realm/react` | see realm | see realm | high |  |

### files

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-file-system` | FileManager | Context.filesDir / java.io.File | medium | Files written by hybrid stay in the sandbox: note paths |
| `react-native-fs` | FileManager | java.io.File | medium |  |
| `react-native-blob-util` | URLSession download tasks + FileManager | OkHttp / DownloadManager + File | medium |  |

### animation

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-reanimated` | withAnimation, PhaseAnimator, KeyframeAnimator, matchedGeometryEffect | animate*AsState, AnimatedVisibility, Transition, SharedTransitionLayout | low | Rebuild the intent; don't port worklets |
| `lottie-react-native` | lottie-ios | lottie-compose | low | Reuse the same JSON files |

### gestures

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-gesture-handler` | SwiftUI gestures | Modifier.pointerInput / detect*Gestures / draggable | low |  |

### ui

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@shopify/flash-list` | List / LazyVStack | LazyColumn / LazyVerticalGrid | low |  |
| `react-native-svg` | SF Symbols / vector assets (PDF/SVG) / Canvas | ImageVector / vector drawables / Canvas | low |  |
| `react-native-vector-icons` | SF Symbols or exported assets | Material Symbols / vector drawables | low | List every icon used; map once in DesignSystem |
| `@expo/vector-icons` | SF Symbols or exported assets | Material Symbols / vector drawables | low | List every icon used; map once in DesignSystem |
| `expo-image` | AsyncImage or Nuke / Kingfisher | Coil | low | Record cache policy and placeholders |
| `react-native-fast-image` | Nuke / Kingfisher | Coil | low |  |
| `react-native-linear-gradient` | LinearGradient | Brush.linearGradient | low |  |
| `expo-linear-gradient` | LinearGradient | Brush.linearGradient | low |  |
| `expo-blur` | Material (.ultraThinMaterial) | Translucent scrim, or a backdrop-blur library (e.g. Haze) | low | Modifier.blur blurs the composable itself, not what is behind it |
| `@react-native-community/blur` | Material | Translucent scrim, or a backdrop-blur library (e.g. Haze) | low | Modifier.blur is not a backdrop blur |
| `@gorhom/bottom-sheet` | .sheet + presentationDetents | ModalBottomSheet / BottomSheetScaffold | low |  |
| `react-native-modal` | .sheet / .fullScreenCover / .alert | Dialog / ModalBottomSheet / AlertDialog | low |  |
| `react-native-pager-view` | TabView(.page) | HorizontalPager | low |  |
| `react-native-tab-view` | Picker(.segmented) + TabView(.page) | TabRow + HorizontalPager | low |  |
| `@react-native-community/datetimepicker` | DatePicker | Material 3 DatePicker / TimePicker | low |  |
| `@react-native-picker/picker` | Picker | ExposedDropdownMenuBox | low |  |
| `@react-native-community/slider` | Slider | Slider | low |  |
| `react-native-toast-message` | DesignSystem toast overlay | Snackbar | low |  |

### webview

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-webview` | WKWebView (UIViewRepresentable) or SwiftUI WebView (iOS 26+) | WebView via AndroidView | medium | Decide per screen: keep web content or rebuild natively. Check JS bridges (postMessage) |

### maps

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-maps` | MapKit (SwiftUI Map) or Google Maps SDK | Google Maps Compose | medium | Provider may differ per platform in hybrid: check PROVIDER_GOOGLE usage |
| `@rnmapbox/maps` | Mapbox Maps SDK for iOS | Mapbox Maps SDK for Android | medium |  |

### styling

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `nativewind` | Design tokens + DesignSystem | Design tokens + :core:designsystem | low | tailwind.config.js is a token source |
| `tailwindcss` | Design tokens | Design tokens | low |  |
| `styled-components` | Design tokens + DesignSystem | Design tokens + :core:designsystem | low | ThemeProvider theme object is a token source |
| `@emotion/native` | Design tokens | Design tokens | low |  |

### ui-kit

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-paper` | DesignSystem components | Material 3 (close match) | low |  |
| `tamagui` | DesignSystem components | DesignSystem components | low | Tamagui config is a token source |
| `@rneui/themed` | DesignSystem components | DesignSystem components | low |  |
| `native-base` | DesignSystem components | DesignSystem components | low |  |
| `@gluestack-ui/*` | DesignSystem components | DesignSystem components | low |  |

### app-shell

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-splash-screen` | Launch screen (UILaunchScreen) | core-splashscreen (SplashScreen API) | low | preventAutoHideAsync logic = startup gating: specify it |
| `react-native-bootsplash` | Launch screen | core-splashscreen | low |  |
| `expo-font` | Bundled fonts (UIAppFonts) | res/font | low | Check font licences for native embedding |
| `@expo-google-fonts/*` | Bundled fonts | res/font or downloadable fonts | low |  |
| `expo-status-bar` | preferredColorScheme / toolbar styles | enableEdgeToEdge() SystemBarStyle | low |  |

### form-factors

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-screen-orientation` | Supported orientations per scene; no runtime locks on large screens | Activity orientation (ignored on sw≥600dp at targetSdk 36) | medium | Runtime orientation locks: record each screen in the spec's Form factors (ADR-0017) |
| `react-native-orientation-locker` | Supported orientations per scene | Activity orientation (ignored on large screens at targetSdk 36) | medium | Same as expo-screen-orientation |

### device

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-camera` | AVFoundation (AVCaptureSession) | CameraX | medium |  |
| `react-native-vision-camera` | AVFoundation | CameraX | medium | Frame processors -> Vision / ML Kit |
| `expo-barcode-scanner` | VisionKit DataScannerViewController / AVCaptureMetadataOutput | ML Kit barcode scanning + CameraX | medium | Deprecated in Expo |
| `expo-image-picker` | PhotosPicker | Photo Picker (PickVisualMedia) | low |  |
| `react-native-image-picker` | PhotosPicker / UIImagePickerController (camera) | Photo Picker / TakePicture contract | low |  |
| `react-native-image-crop-picker` | PhotosPicker + custom crop | Photo Picker + crop library | low |  |
| `expo-media-library` | Photos framework | MediaStore | low |  |
| `@react-native-camera-roll/camera-roll` | Photos framework | MediaStore | low |  |
| `expo-location` | CoreLocation (CLLocationUpdate) | Fused Location Provider | medium | Background location = extra review scrutiny on both stores |
| `react-native-geolocation-service` | CoreLocation | Fused Location Provider | medium |  |
| `@react-native-community/geolocation` | CoreLocation | Fused Location Provider | medium |  |
| `react-native-permissions` | Per-framework authorization APIs | ActivityResultContracts.RequestPermission | low | Centralise in a core permissions module on both |
| `@react-native-community/netinfo` | NWPathMonitor | ConnectivityManager.NetworkCallback | low |  |
| `react-native-device-info` | UIDevice / Bundle / ProcessInfo | Build / PackageManager | low | Device IDs sent to backend must stay stable: check which one |
| `expo-device` | UIDevice | Build | low |  |
| `expo-application` | Bundle / identifierForVendor | PackageManager / ANDROID_ID | low | IDs sent to backend must stay stable |
| `expo-haptics` | .sensoryFeedback / UIFeedbackGenerator | HapticFeedback / performHapticFeedback | low |  |
| `react-native-haptic-feedback` | .sensoryFeedback | performHapticFeedback | low |  |
| `expo-sharing` | ShareLink / UIActivityViewController | Sharesheet (ACTION_SEND) | low |  |
| `react-native-share` | ShareLink | Sharesheet | low |  |
| `expo-clipboard` | UIPasteboard | ClipboardManager | low |  |
| `@react-native-clipboard/clipboard` | UIPasteboard | ClipboardManager | low |  |
| `expo-document-picker` | .fileImporter | OpenDocument contract | low |  |
| `@react-native-documents/picker` | .fileImporter | OpenDocument contract | low |  |
| `expo-contacts` | Contacts / ContactsUI | ContactsContract | low |  |
| `react-native-contacts` | Contacts / ContactsUI | ContactsContract | low |  |
| `expo-calendar` | EventKit | CalendarContract | low |  |
| `react-native-ble-plx` | CoreBluetooth | android.bluetooth.le | medium |  |
| `react-native-nfc-manager` | Core NFC | android.nfc | medium |  |

### auth

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-local-authentication` | LocalAuthentication (LAContext) | androidx.biometric BiometricPrompt | medium |  |
| `react-native-biometrics` | LocalAuthentication + Keychain | BiometricPrompt + Keystore | medium | Keys created by the library may be bound to biometrics: check migration |
| `expo-auth-session` | ASWebAuthenticationSession (or AppAuth-iOS) | AppAuth-Android / Custom Tabs | high | Register native redirect URIs with the IdP |
| `react-native-app-auth` | AppAuth-iOS | AppAuth-Android | high |  |
| `@react-native-google-signin/google-signin` | GoogleSignIn-iOS | Credential Manager (Sign in with Google) | high |  |
| `expo-apple-authentication` | AuthenticationServices (Sign in with Apple) | Web flow (if offered) | high |  |
| `@invertase/react-native-apple-authentication` | AuthenticationServices | Web flow | high |  |
| `react-native-fbsdk-next` | Facebook iOS SDK | Facebook Android SDK | medium |  |

### config

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-constants` | Info.plist / build settings | BuildConfig | low | expoConfig.extra values = build-time config |
| `react-native-config` | xcconfig + Info.plist | buildConfigField + product flavors | low | .env files -> build configurations |
| `react-native-dotenv` | xcconfig | buildConfigField | low |  |

### links

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-linking` | onOpenURL + universal links | Intent filters + App Links | medium |  |
| `expo-web-browser` | SFSafariViewController / openURL | Custom Tabs | low |  |
| `react-native-inappbrowser-reborn` | SFSafariViewController | Custom Tabs | low |  |
| `@react-native-firebase/dynamic-links` | Universal links (Firebase Dynamic Links is shut down) | App Links | high | Replace before cut-over |

### media

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-av` | AVPlayer / AVAudioSession | Media3 ExoPlayer | medium | Deprecated in Expo in favour of expo-video / expo-audio |
| `expo-video` | AVKit VideoPlayer | Media3 ExoPlayer + PlayerView | medium |  |
| `expo-audio` | AVAudioPlayer / AVAudioSession | Media3 | medium |  |
| `react-native-video` | AVPlayer | Media3 ExoPlayer | medium | DRM config must be ported |
| `react-native-track-player` | AVPlayer + MPNowPlayingInfoCenter | Media3 MediaSessionService | medium | Background playback entitlements |

### background

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-background-fetch` | BGTaskScheduler | WorkManager | medium |  |
| `expo-task-manager` | BGTaskScheduler / location updates | WorkManager / foreground service | medium |  |
| `react-native-background-fetch` | BGTaskScheduler | WorkManager | medium |  |

### push

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-notifications` | UserNotifications + APNs | FCM (firebase-messaging) + notification channels | high | If the backend sends through the Expo Push API (ExponentPushToken), plan the switch to APNs/FCM tokens |
| `@react-native-firebase/messaging` | FirebaseMessaging | firebase-messaging | high | Same Firebase project; check token registration endpoint |
| `@notifee/react-native` | UNUserNotificationCenter | NotificationCompat + channels | medium | Keep channel IDs identical (user channel settings are keyed by ID) |
| `react-native-push-notification` | UserNotifications | NotificationCompat + channels | medium |  |
| `@react-native-community/push-notification-ios` | UserNotifications | n/a | medium |  |
| `react-native-onesignal` | OneSignal iOS SDK | OneSignal Android SDK | high |  |

### engagement

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@braze/react-native-sdk` | Braze Swift SDK | Braze Android SDK | medium |  |

### firebase

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@react-native-firebase/*` | Firebase Apple SDK (same module) | Firebase Android SDK (same module) | medium | Reuse GoogleService-Info.plist / google-services.json |

### analytics

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@segment/analytics-react-native` | analytics-swift | analytics-kotlin | high | Event names verbatim (contracts/analytics) |
| `@amplitude/analytics-react-native` | Amplitude-Swift | Amplitude-Kotlin | high | Keep device/user ID continuity |
| `mixpanel-react-native` | mixpanel-swift | mixpanel-android | high | Keep distinct_id continuity |
| `posthog-react-native` | posthog-ios | posthog-android | high |  |

### crash-reporting

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@sentry/react-native` | sentry-cocoa | sentry-android | medium | Tag releases to compare hybrid vs native |
| `sentry-expo` | sentry-cocoa | sentry-android | medium |  |
| `@bugsnag/react-native` | bugsnag-cocoa | bugsnag-android | medium |  |

### flags

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `@launchdarkly/react-native-client-sdk` | LaunchDarkly iOS SDK | LaunchDarkly Android SDK | medium | Same flag keys and context attributes |
| `@statsig/react-native-bindings` | Statsig iOS SDK | Statsig Android SDK | medium |  |

### payments

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-native-iap` | StoreKit 2 | Play Billing Library | high | Same product IDs; restore + receipt validation flow |
| `expo-in-app-purchases` | StoreKit 2 | Play Billing Library | high | Deprecated |
| `react-native-purchases` | RevenueCat purchases-ios | RevenueCat purchases-android | high | Same app user ID for entitlement continuity |
| `@stripe/stripe-react-native` | Stripe iOS SDK | Stripe Android SDK | high |  |

### ota

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `expo-updates` | none (store releases) | none (store releases) | high | Analyse the JS actually live in production; freeze OTA before cut-over |
| `react-native-code-push` | none | none | high | App Center is retired; same OTA caveats |

### i18n

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `i18next` | String Catalogs (generated) | strings.xml (generated) | medium | Keys reused verbatim via contracts/strings |
| `react-i18next` | String Catalogs | strings.xml | low |  |
| `i18n-js` | String Catalogs | strings.xml | medium |  |
| `react-intl` | String Catalogs | strings.xml | medium | ICU message syntax: convert placeholders and plurals carefully |
| `expo-localization` | Locale.current | LocaleManager / per-app language | low |  |
| `react-native-localize` | Locale.current | LocaleManager | low |  |

### dates

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `moment` | Date + FormatStyle / Calendar | java.time | medium | Specify expected output per locale; formats differ subtly |
| `dayjs` | Date + FormatStyle | java.time | medium |  |
| `date-fns` | Date + FormatStyle | java.time | medium |  |
| `luxon` | Date + FormatStyle | java.time | medium |  |

### validation

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `zod` | Validators in domain/view model | Validators in domain/view model | medium | Schemas are the business rules: turn them into ACs + shared test vectors |
| `yup` | Validators | Validators | medium |  |

### forms

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `react-hook-form` | Form state in view model | Form state in view model | low | Note validation mode (onBlur/onChange/onSubmit) |
| `formik` | Form state in view model | Form state in view model | low |  |

### utility

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `lodash` | Swift standard library | Kotlin standard library | low |  |

### tooling

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `patch-package` | n/a | n/a | medium | Each patch in patches/ is behaviour to reproduce or drop |
| `expo-dev-client` | n/a | n/a | low |  |

### testing

| RN / Expo package | iOS | Android | Risk | Notes |
|---|---|---|---|---|
| `detox` | Maestro flows (e2e/) | Maestro flows (e2e/) | low | Existing Detox tests are behaviour evidence: port to Maestro |
| `@testing-library/react-native` | Swift Testing / snapshot tests | JUnit / Compose UI tests | low | Existing tests = acceptance criteria candidates |
| `jest` | Swift Testing | JUnit | low | Pure-logic tests give test vectors for contracts/fixtures |

## Porting rules

1. **Rebuild behaviour, not code.** Never transliterate JSX into SwiftUI/Compose line by line. Read the spec and
   write idiomatic native code.
2. **Prefer the platform SDK over third-party** when it covers the need (PhotosPicker, Photo Picker, StoreKit 2,
   Credential Manager). Fewer dependencies means fewer upgrades across two codebases.
3. **Same vendor on both platforms** for anything with a backend (analytics, crash reporting, flags, push provider,
   payments). Otherwise dashboards and behaviour diverge.
4. **Libraries that hold user data** (storage, keychain, DB, analytics identity, purchases) are migration items,
   not just replacements. See `11-cutover-and-release.md`.
5. **Custom native modules are already native.** Reuse their core logic (`port-native-module`). Drop the bridge.
