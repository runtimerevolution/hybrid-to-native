package {{PACKAGE}}.feature.home

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import {{PACKAGE}}.core.designsystem.AppTheme
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.GraphicsMode

/**
 * Layout matrix (ADR-0017, guideline 10): compact portrait, compact landscape, expanded.
 * Record references with `./gradlew recordRoborazziDebug`, commit them, then CI runs `verifyRoborazziDebug`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class HomeLayoutMatrixTest {
    // Set the size inside the test, not with @Config: with @Config, a later test can keep the previous test's
    // window size, so content is laid out off-canvas and the capture comes out blank.
    private fun capture(
        name: String,
        qualifiers: String,
    ) {
        RuntimeEnvironment.setQualifiers(qualifiers)
        captureRoboImage("src/test/screenshots/$name.png") {
            AppTheme { HomeContent(state = HomeUiState(greeting = "Hello from the layout matrix"), onAction = {}) }
        }
    }

    @Test
    fun compactPortrait() = capture("home_compact_portrait", "w411dp-h891dp-port-xxhdpi")

    @Test
    fun compactLandscape() = capture("home_compact_landscape", "w891dp-h411dp-land-xxhdpi")

    @Test
    fun expanded() = capture("home_expanded", "w1280dp-h800dp-land-xhdpi")
}
