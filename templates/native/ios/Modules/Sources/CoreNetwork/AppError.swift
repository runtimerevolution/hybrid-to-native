/// The same error cases on both platforms (guideline 05). Mapped from backend codes in contracts/errors.md.
public enum AppError: Error, Equatable, Sendable {
    case network
    case unauthorized
    case server(code: Int)
    case validation(field: String)
    /// A 2xx response whose body doesn't match the contract.
    case decoding
    case unknown
}
