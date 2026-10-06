import CoreAnalytics
import CoreDataLayer
import DesignSystem
import Observation

@MainActor @Observable
public final class HomeViewModel {
    public private(set) var state = HomeUiState()
    public let effects = EffectChannel<HomeEffect>()
    private let repository: any GreetingRepository
    private let analytics: any Analytics
    @ObservationIgnored private var didLoad = false
    @ObservationIgnored private var loadTask: Task<Void, Never>?

    /// Cheap init: no work here. Loading starts from `.appeared` (guideline 05 § State granularity).
    public init(repository: any GreetingRepository, analytics: any Analytics) {
        self.repository = repository
        self.analytics = analytics
    }

    public func onAction(_ action: HomeAction) {
        switch action {
        case .appeared:
            guard !didLoad else { return }  // idempotent: .task runs again on every appear
            didLoad = true
            load()
        case .refreshTapped:
            load()
            effects.send(.scrollToTop)
        }
    }

    private func load() {
        loadTask?.cancel()
        loadTask = Task {
            update { $0.isLoading = true }
            let result = await repository.greeting()
            update {
                $0.isLoading = false
                if case .success(let text) = result { $0.greeting = text }
            }
        }
    }

    /// Writes only when the value changes, like Kotlin's `_state.update { }`.
    private func update(_ change: (inout HomeUiState) -> Void) {
        var next = state
        change(&next)
        if next != state { state = next }
    }
}
