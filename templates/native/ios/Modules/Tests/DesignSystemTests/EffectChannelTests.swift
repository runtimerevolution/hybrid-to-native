import DesignSystem
import Testing

@MainActor
struct EffectChannelTests {
    @Test("effects sent while nobody listens reach the next subscriber")
    func bufferedUntilSubscribed() async {
        let channel = EffectChannel<Int>()
        channel.send(1)
        var received: [Int] = []
        for await value in channel.stream() {
            received.append(value)
            break
        }
        #expect(received == [1])
    }
}
