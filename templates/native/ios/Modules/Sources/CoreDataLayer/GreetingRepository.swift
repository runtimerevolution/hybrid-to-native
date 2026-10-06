import CoreNetwork

/// Sample repository: replace it with the first real one. Repositories expose domain models, never DTOs (guideline 05).
public protocol GreetingRepository: Sendable {
    func greeting() async -> Result<String, AppError>
}

public struct DefaultGreetingRepository: GreetingRepository {
    public init() {}

    public func greeting() async -> Result<String, AppError> {
        .success("Hello from {{APP_NAME}}")
    }
}
