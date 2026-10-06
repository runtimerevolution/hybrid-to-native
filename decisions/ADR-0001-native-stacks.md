# ADR-0001: Native stacks — SwiftUI + Jetpack Compose, two separate codebases

- **Status:** accepted
- **Applies to:** both

## Context

The hybrid React Native / Expo app is being replaced by native apps. AI agents will build each feature on both
platforms at the same time, from one platform-neutral spec.

## Options

| Option | Pros | Cons |
|---|---|---|
| SwiftUI + Compose, separate codebases | Most idiomatic, best vendor tooling and agent skills, declarative on both sides so the mapping is close to 1:1 | Two implementations of domain/data logic |
| SwiftUI + Compose with Kotlin Multiplatform shared logic | One domain/data layer | Swift interop friction, one more toolchain, iOS team depends on Kotlin |
| UIKit + Views | Mature | Imperative, further from the declarative mental model agents handle well |

## Decision

**SwiftUI (Swift 6) on iOS and Jetpack Compose (Kotlin) on Android, in two separate repositories, with no shared
runtime code.** Parity comes from shared specs, contracts (generated code), a mirrored architecture and shared
e2e flows, not from shared code.

## Consequences

- Business logic is implemented twice. Shared test vectors in `contracts/fixtures/` keep the two implementations equal.
- `guidelines/05-mirrored-architecture.md` is mandatory. Its naming map is what makes parallel agents work.
- Reconsider KMP only for a large, pure-logic module with frequent changes (record it in a new ADR).
