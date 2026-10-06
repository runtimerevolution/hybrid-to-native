plugins {
    id("kit.android.library")
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "{{PACKAGE}}.core.data"
}

dependencies {
    api(projects.core.network)
    implementation(projects.core.datastore)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}
