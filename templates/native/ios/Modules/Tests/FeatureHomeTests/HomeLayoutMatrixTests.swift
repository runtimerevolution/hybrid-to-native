import FeatureHome
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

/// Layout matrix (ADR-0017, guideline 10): compact portrait, compact landscape, expanded.
/// First run records the reference images (and fails once); commit them, then runs compare.
/// Snapshots depend on the simulator OS, so CI must use the same one as the recording. The scale is pinned (2x) so a
/// 2x or 3x host gives the same images, and a small perceptual tolerance absorbs anti-aliasing differences between Macs.
@MainActor
@Suite(.snapshots(record: .missing))
struct HomeLayoutMatrixTests {
    private static let traits = UITraitCollection(displayScale: 2)

    private var content: some View {
        var state = HomeUiState()
        state.greeting = "Hello from the layout matrix"
        return NavigationStack { HomeContent(state: state, onAction: { _ in }) }
    }

    @Test func compactPortrait() {
        assertSnapshot(
            of: content,
            as: .image(perceptualPrecision: 0.98, layout: .device(config: .iPhone13(.portrait)), traits: Self.traits)
        )
    }

    @Test func compactLandscape() {
        assertSnapshot(
            of: content,
            as: .image(perceptualPrecision: 0.98, layout: .device(config: .iPhone13(.landscape)), traits: Self.traits)
        )
    }

    @Test func expanded() {
        assertSnapshot(
            of: content,
            as: .image(
                perceptualPrecision: 0.98, layout: .device(config: .iPadPro12_9(.landscape)), traits: Self.traits)
        )
    }
}
