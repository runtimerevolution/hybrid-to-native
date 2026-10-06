import CoreAnalytics
import CoreDataLayer

/// Everything the app needs, built once at launch. Tests and previews build their own with fakes.
struct AppEnvironment {
    let analytics: any Analytics
    let greetingRepository: any GreetingRepository

    static func live() -> AppEnvironment {
        AppEnvironment(
            analytics: DebugLogAnalytics(),
            greetingRepository: DefaultGreetingRepository()
        )
    }
}
