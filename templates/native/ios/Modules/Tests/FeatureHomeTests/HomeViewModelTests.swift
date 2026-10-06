import CoreAnalytics
import CoreDataLayer
import CoreNetwork
import FeatureHome
import Testing

struct FakeGreetingRepository: GreetingRepository {
    var result: Result<String, AppError> = .success("Hi")
    func greeting() async -> Result<String, AppError> { result }
}

struct NoAnalytics: Analytics {
    func track(_ event: AnalyticsEvent) {}
}

@MainActor
struct HomeViewModelTests {
    @Test("appeared loads the greeting once")
    func appearedLoadsOnce() async throws {
        let viewModel = HomeViewModel(repository: FakeGreetingRepository(), analytics: NoAnalytics())
        viewModel.onAction(.appeared)
        viewModel.onAction(.appeared)
        try await Task.sleep(for: .milliseconds(50))
        #expect(viewModel.state.greeting == "Hi")
        #expect(viewModel.state.isLoading == false)
    }
}
