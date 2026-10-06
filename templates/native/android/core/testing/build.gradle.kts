plugins {
    id("kit.android.library")
}

android {
    namespace = "{{PACKAGE}}.core.testing"
}

dependencies {
    api(libs.junit)
    api(libs.kotlinx.coroutines.test)
    api(libs.turbine)
}
