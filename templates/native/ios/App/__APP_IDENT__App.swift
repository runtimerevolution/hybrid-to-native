import CoreAnalytics
import CoreDataLayer
import SwiftUI

@main
struct {{APP_IDENT}}App: App {
    /// Composition root: every service is created here and passed down by initialiser (guideline 05).
    private let environment = AppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            RootView(environment: environment)
        }
    }
}
