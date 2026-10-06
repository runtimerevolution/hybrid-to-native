plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.roborazzi) apply false
    alias(libs.plugins.spotless)
}

spotless {
    kotlin {
        target("**/*.kt")
        targetExclude("**/build/**", "**/generated/**")
        ktlint(libs.versions.ktlint.get())
    }
    kotlinGradle {
        target("**/*.kts")
        targetExclude("**/build/**")
        ktlint(libs.versions.ktlint.get())
    }
}
