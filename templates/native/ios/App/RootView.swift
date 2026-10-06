import DesignSystem
import FeatureHome
import SwiftUI

/// Root navigation. Routes come from the contracts (contracts/deeplinks.md); one typed path per flow (guideline 06).
struct RootView: View {
    let environment: AppEnvironment
    @State private var path: [AppRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeScreen(
                viewModel: HomeViewModel(repository: environment.greetingRepository, analytics: environment.analytics)
            )
            .navigationDestination(for: AppRoute.self) { route in
                switch route {
                case .home: EmptyView()
                }
            }
        }
    }
}

enum AppRoute: Hashable {
    case home
}
