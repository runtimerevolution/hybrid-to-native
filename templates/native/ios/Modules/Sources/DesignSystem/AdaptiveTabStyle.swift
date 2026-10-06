import SwiftUI

/// Sidebar-adaptable tabs where available (iOS 18+), the default tab style on older systems (guideline 06).
public struct AdaptiveTabStyle: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content.tabViewStyle(.sidebarAdaptable)
        } else {
            content
        }
    }
}
