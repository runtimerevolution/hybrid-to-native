plugins {
    id("kit.android.library")
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "{{PACKAGE}}.core.analytics"
}

dependencies {
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}
