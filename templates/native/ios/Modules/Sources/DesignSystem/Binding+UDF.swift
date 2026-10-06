import SwiftUI

extension Binding {
    /// Unidirectional binding: reads from immutable UI state, writes by sending an action (guideline 06).
    /// `TextField("", text: .udf(state.email) { onAction(.emailChanged($0)) })`
    @MainActor
    public static func udf(_ value: Value, send: @escaping @MainActor (Value) -> Void) -> Binding<Value> {
        Binding(get: { value }, set: { send($0) })
    }
}
