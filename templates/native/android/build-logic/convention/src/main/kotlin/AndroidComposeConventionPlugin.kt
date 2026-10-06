import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType

/** Compose for an application or library module: compiler plugin, BOM and the common UI artifacts. */
class AndroidComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
            extensions.findByType(ApplicationExtension::class.java)?.buildFeatures?.compose = true
            extensions.findByType(LibraryExtension::class.java)?.buildFeatures?.compose = true
            val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")
            dependencies {
                val bom = platform(libs.findLibrary("androidx-compose-bom").get())
                add("implementation", bom)
                add("testImplementation", bom)
                add("implementation", libs.findLibrary("androidx-compose-ui").get())
                add("implementation", libs.findLibrary("androidx-compose-material3").get())
                add("implementation", libs.findLibrary("androidx-compose-ui-tooling-preview").get())
                add("debugImplementation", libs.findLibrary("androidx-compose-ui-tooling").get())
            }
        }
    }
}
