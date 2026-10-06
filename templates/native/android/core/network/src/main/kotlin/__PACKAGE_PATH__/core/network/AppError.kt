package {{PACKAGE}}.core.network

/** The same error cases on both platforms (guideline 05). Mapped from backend codes in contracts/errors.md. */
sealed interface AppError {
    data object Network : AppError

    data object Unauthorized : AppError

    data class Server(
        val code: Int,
    ) : AppError

    data class Validation(
        val field: String,
    ) : AppError

    /** A 2xx response whose body doesn't match the contract. */
    data object Decoding : AppError

    data object Unknown : AppError
}

/** Async content state shared by screens (guideline 05 § Type mapping). */
sealed interface Loadable<out T> {
    data object Idle : Loadable<Nothing>

    data object Loading : Loadable<Nothing>

    data class Loaded<T>(
        val value: T,
    ) : Loadable<T>

    data class Failed(
        val error: AppError,
    ) : Loadable<Nothing>
}
