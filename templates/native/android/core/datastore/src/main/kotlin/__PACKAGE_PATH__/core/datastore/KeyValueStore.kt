package {{PACKAGE}}.core.datastore

/** Small, non-sensitive preferences (DataStore behind it once needed). Secrets go to the Android Keystore, never here. */
interface KeyValueStore {
    suspend fun string(key: String): String?

    suspend fun set(
        key: String,
        value: String?,
    )
}
