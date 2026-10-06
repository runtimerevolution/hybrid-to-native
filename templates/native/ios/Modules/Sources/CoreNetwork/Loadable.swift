/// Async content state shared by screens (guideline 05 § Type mapping).
public enum Loadable<Value: Sendable & Equatable>: Sendable, Equatable {
    case idle
    case loading
    case loaded(Value)
    case failed(AppError)
}
