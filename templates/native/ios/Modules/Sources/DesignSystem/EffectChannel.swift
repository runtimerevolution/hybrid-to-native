/// One-subscriber, buffered effect channel. Mirrors Kotlin `Channel(BUFFERED).receiveAsFlow()`:
/// effects sent while no screen is listening are kept and delivered to the next subscriber (guideline 05).
@MainActor
public final class EffectChannel<Effect: Sendable> {
    private var continuation: AsyncStream<Effect>.Continuation?
    private var buffer: [Effect] = []

    public init() {}

    public func send(_ effect: Effect) {
        if let continuation, case .enqueued = continuation.yield(effect) { return }
        buffer.append(effect)
    }

    /// Call from the screen's `.task`. Each call starts a new subscription and replaces the previous one.
    public func stream() -> AsyncStream<Effect> {
        continuation?.finish()
        let (stream, continuation) = AsyncStream.makeStream(of: Effect.self)
        self.continuation = continuation
        for effect in buffer { continuation.yield(effect) }
        buffer.removeAll()
        return stream
    }
}
