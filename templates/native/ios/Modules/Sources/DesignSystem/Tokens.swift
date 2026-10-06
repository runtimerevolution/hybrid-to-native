import SwiftUI

/// Design tokens. Generated from contracts/design-tokens once the design file exists (guideline 08); placeholders until then.
public enum Spacing {
    public static let s: CGFloat = 8
    public static let m: CGFloat = 16
    public static let l: CGFloat = 24
}

extension View {
    /// Keeps running text readable on large screens (ADR-0017): content is centred and capped in width.
    public func readableWidth(_ maxWidth: CGFloat = 640) -> some View {
        frame(maxWidth: maxWidth).frame(maxWidth: .infinity)
    }
}
