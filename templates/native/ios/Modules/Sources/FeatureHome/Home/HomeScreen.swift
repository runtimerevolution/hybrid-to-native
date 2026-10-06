import DesignSystem
import SwiftUI

/// Owns the view model and collects effects. All drawing happens in `HomeContent`.
public struct HomeScreen: View {
    @State private var viewModel: HomeViewModel

    public init(viewModel: HomeViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        HomeContent(state: viewModel.state, onAction: viewModel.onAction)
            .task {
                viewModel.onAction(.appeared)
                for await effect in viewModel.effects.stream() {
                    switch effect {
                    case .scrollToTop: break  // a real screen scrolls its list here
                    }
                }
            }
    }
}

/// Pure view: state in, actions out. Previews and snapshot tests use it with fixture states.
public struct HomeContent: View {
    let state: HomeUiState
    let onAction: @MainActor (HomeAction) -> Void

    public init(state: HomeUiState, onAction: @escaping @MainActor (HomeAction) -> Void) {
        self.state = state
        self.onAction = onAction
    }

    public var body: some View {
        VStack(spacing: Spacing.m) {
            if state.isLoading {
                ProgressView().accessibilityIdentifier("home.loading")
            }
            Text(state.greeting)
                .font(.title2)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("home.greeting")
            Button(L10n.commonRefresh) { onAction(.refreshTapped) }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("home.refreshButton")
        }
        .padding(Spacing.l)
        .readableWidth()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("home.root")
        .navigationTitle(L10n.appName)
    }
}

#Preview {
    var state = HomeUiState()
    state.greeting = "Hello"
    return NavigationStack { HomeContent(state: state, onAction: { _ in }) }
}
