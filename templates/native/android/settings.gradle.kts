pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

rootProject.name = "{{APP_IDENT}}"

include(":app")
include(":core:network", ":core:data", ":core:datastore", ":core:designsystem", ":core:analytics", ":core:testing")
include(":feature:home")
