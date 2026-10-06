plugins {
    id("kit.android.library")
    id("kit.android.compose")
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.roborazzi)
}

android {
    namespace = "{{PACKAGE}}.feature.home"
}

dependencies {
    implementation(projects.core.data)
    implementation(projects.core.analytics)
    implementation(projects.core.designsystem)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.hilt.lifecycle.viewmodel.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    testImplementation(projects.core.testing)
    testImplementation(libs.robolectric)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.roborazzi.junit.rule)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.test.espresso.core)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
