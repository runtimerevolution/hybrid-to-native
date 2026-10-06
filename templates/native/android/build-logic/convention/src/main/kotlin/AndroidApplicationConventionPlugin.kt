import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.withType

class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.application")
            extensions.configure<ApplicationExtension> {
                compileSdk = ProjectConfig.COMPILE_SDK
                defaultConfig {
                    minSdk = ProjectConfig.MIN_SDK
                    targetSdk = ProjectConfig.TARGET_SDK
                }
                compileOptions {
                    sourceCompatibility = ProjectConfig.JAVA
                    targetCompatibility = ProjectConfig.JAVA
                }
                testOptions.unitTests.isIncludeAndroidResources = true
            }
            // Hilt/KSP add generated test sources to modules that have no tests yet; Gradle 9 would fail those.
            tasks.withType<Test>().configureEach {
                failOnNoDiscoveredTests.set(false)
                // Robolectric on SDK 36+ reads FileDescriptor internals through jdk.internal.access
                jvmArgs("--add-exports=java.base/jdk.internal.access=ALL-UNNAMED")
            }
        }
    }
}
