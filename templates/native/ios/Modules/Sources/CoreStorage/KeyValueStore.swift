import Foundation

/// Small, non-sensitive preferences. Secrets go to the Keychain, never here.
public protocol KeyValueStore {
    func string(forKey key: String) -> String?
    func set(_ value: String?, forKey key: String)
}

public final class UserDefaultsStore: KeyValueStore {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func string(forKey key: String) -> String? { defaults.string(forKey: key) }
    public func set(_ value: String?, forKey key: String) { defaults.set(value, forKey: key) }
}
