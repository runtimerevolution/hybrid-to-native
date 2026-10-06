/// Sample feature in the kit's pattern (guideline 05): replace it with the first real feature.
public struct HomeUiState: Equatable, Sendable {
    public var greeting: String = ""
    public var isLoading = false

    public init() {}
}

public enum HomeAction: Sendable {
    case appeared
    case refreshTapped
}

public enum HomeEffect: Sendable, Equatable {
    case scrollToTop
}
