---
id: SLICE-01
title: <demo goal, e.g. "Launch → log in → home list">
status: planned          # planned | contracts | building | demo | review | merged
features: []             # in dependency order, e.g. [CORE-SHELL, CORE-SESSION, AUTH-LOGIN, HOME-FEED]
mode: slice              # slice | feature (feature mode = risky features, one at a time)
---

# SLICE-01: <demo goal>

## Why this slice, why now

<!-- One or two sentences: what the product owner will be able to tap at the end, and why it comes first. -->

## Features (dependency order)

| # | Feature | Screens | Depends on | Notes |
|---|---|---|---|---|
| 1 | | | | |

## Demo

- **iOS:** <!-- scheme, simulator, how to log in (test account owner) -->
- **Android:** <!-- Gradle task / variant, emulator -->
- **Screenshots:** `specs/features/<ID>/assets/{ios,android}/`

## Contract change requests (both platforms)

| CCR | Feature | Raised by | Conservative reading used | Decision | Applied to both |
|---|---|---|---|---|---|

## Editorial amendments to acknowledge

<!-- `node tools/spec.mjs list` shows "+N editorial to acknowledge". The PO acknowledges with:
     node tools/spec.mjs approve --slice SLICE-01 --by "<name>" -->

## Reviews

| Review | File | Verdict |
|---|---|---|
| Parity | `SLICE-01-review.md` | |
| iOS quality | `SLICE-01-review-quality-ios.md` | |
| Android quality | `SLICE-01-review-quality-android.md` | |
