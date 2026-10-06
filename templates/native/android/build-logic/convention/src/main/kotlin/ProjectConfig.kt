import org.gradle.api.JavaVersion

/** One place for the SDK levels and JVM target used by every module (guideline 07 § Baseline). */
object ProjectConfig {
    const val COMPILE_SDK = {{COMPILE_SDK}}
    const val MIN_SDK = {{MIN_SDK}}
    const val TARGET_SDK = {{TARGET_SDK}}
    val JAVA = JavaVersion.VERSION_17
}
