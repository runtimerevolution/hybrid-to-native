// swift-tools-version: 6.2
// Local package with every module of the app (guideline 05 § Core modules). The App target stays thin.
import PackageDescription

let package = Package(
    name: "Modules",
    defaultLocalization: "en",
    platforms: [.iOS("{{IOS_MIN}}")],
    products: [
        .library(name: "CoreNetwork", targets: ["CoreNetwork"]),
        .library(name: "CoreStorage", targets: ["CoreStorage"]),
        .library(name: "CoreDataLayer", targets: ["CoreDataLayer"]),
        .library(name: "CoreAnalytics", targets: ["CoreAnalytics"]),
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "FeatureHome", targets: ["FeatureHome"]),
    ],
    dependencies: [
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "{{SNAPSHOT_TESTING_VERSION}}")
    ],
    targets: [
        .target(name: "CoreNetwork"),
        .target(name: "CoreStorage"),
        .target(name: "CoreDataLayer", dependencies: ["CoreNetwork", "CoreStorage"]),
        .target(name: "CoreAnalytics"),
        .target(name: "DesignSystem", resources: [.process("Resources")]),
        .target(name: "FeatureHome", dependencies: ["CoreAnalytics", "CoreDataLayer", "CoreNetwork", "DesignSystem"]),
        .testTarget(name: "DesignSystemTests", dependencies: ["DesignSystem"]),
        .testTarget(
            name: "FeatureHomeTests",
            dependencies: ["FeatureHome", .product(name: "SnapshotTesting", package: "swift-snapshot-testing")],
            exclude: ["__Snapshots__"]
        ),
    ]
)
