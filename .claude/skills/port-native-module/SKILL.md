---
name: port-native-module
description: 'Move a custom React Native native module, native view or Expo module from hybrid/ into plain native code in both apps, reusing its existing Swift/Obj-C and Kotlin/Java logic and dropping the JS bridge. Use when the inventory lists custom native modules, or the user asks how to migrate a native module or config plugin. Argument: module name.'
---

# port-native-module: keep the native logic, drop the bridge

Custom native modules are already native code. Porting them is mostly *extraction*.

## Steps

1. **Locate everything.** From `analysis/inventory/INVENTORY.md` § Native code (and `analysis/native-code.md`):
   - iOS: files with `RCT_EXPORT_MODULE` / `RCT_EXTERN_MODULE` / `RCT_EXPORT_METHOD`, Expo `Module` definitions,
     view managers.
   - Android: `ReactContextBaseJavaModule`, `@ReactMethod`, `ReactPackage`, Expo `Module`, view managers.
   - JS side: the wrapper that calls it (`NativeModules.X`, `requireNativeModule('X')`, TurboModule spec) and
     every caller in `hybrid/src` (grep for the wrapper).
   - Config plugins that modify native projects for it (entitlements, Info.plist keys, manifest entries, Gradle).

2. **Describe the contract** of the module in `analysis/native-code.md`: each exported method/event/prop, its
   types, threading, errors, and how the JS callers use it. **Callers define what's actually needed.** Unused
   methods aren't ported.

3. **Classify each part:**
   | Part | Action |
   |---|---|
   | Pure platform logic (SDK calls, crypto, file IO, sensors) | Move it into a core module: iOS `Core<Name>` in `Modules/`, Android `:core:<name>` |
   | Bridge glue (argument marshalling, promises, event emitters, `RCTBridge`, `ReactContext`) | Drop |
   | Behaviour that exists only to work around RN (threading hops, JSON serialisation) | Drop, but check nothing depended on it |
   | Native view | Rebuild as a SwiftUI `View` / `@Composable`. Wrap the UIKit/Android `View` only if rebuilding is costly |
   | Config plugin changes | Apply directly in the native project settings (Info.plist, entitlements, manifest, Gradle) |

4. **Design the native API with the mirrored shape** (`guidelines/05-mirrored-architecture.md`): a protocol/interface
   with the same name and methods on both platforms, `async`/`suspend` instead of callbacks and promises,
   `AsyncStream`/`Flow` instead of event emitters, and errors mapped to `AppError`.

5. **Port with tests.** Move the code, modernise only what the guidelines require (e.g. Obj-C → Swift is optional
   but preferred; Java → Kotlin preferred), and add unit tests around the logic. Keep the licence headers of any
   third-party code you copy.

6. **If the module persisted data** (keychain items, files, preferences), the new code must keep reading the same
   locations. Coordinate with `plan-data-migration`.

7. **Record** the result in `analysis/native-code.md` (old → new mapping, dropped methods and why) and, if features
   depend on it, add it to their `depends_on` as a `CORE-*` feature spec.
