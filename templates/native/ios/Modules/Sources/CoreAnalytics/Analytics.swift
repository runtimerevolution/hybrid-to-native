import Foundation
import os

/// Sends events generated from contracts/analytics/events.json (`AnalyticsEvent`, in Generated/).
public protocol Analytics: Sendable {
    func track(_ event: AnalyticsEvent)
}

/// Debug sink used for the analytics parity check (guideline 10 § Analytics diff):
/// every event is logged as one `ANALYTICS {json}` line at .notice level with public privacy.
public struct DebugLogAnalytics: Analytics {
    private static let logger = Logger(subsystem: "{{BUNDLE_ID}}", category: "analytics")

    public init() {}

    public func track(_ event: AnalyticsEvent) {
        let props = event.properties.mapValues { value -> Any in
            switch value {
            case .string(let s): s
            case .int(let i): i
            case .double(let d): d
            case .bool(let b): b
            }
        }
        let payload: [String: Any] = ["name": event.name, "props": props]
        let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])) ?? Data()
        let line = String(decoding: data, as: UTF8.self)
        Self.logger.notice("ANALYTICS \(line, privacy: .public)")
    }
}
