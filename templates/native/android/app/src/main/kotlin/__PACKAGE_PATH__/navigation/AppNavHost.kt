package {{PACKAGE}}.navigation

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import {{PACKAGE}}.feature.home.HomeScreen
import kotlinx.serialization.Serializable

/** Routes come from the contracts (contracts/deeplinks.md). */
@Serializable
data object HomeKey : NavKey

/**
 * Navigation 3 host. The back stack survives process death; restore it only where the spec allows
 * (guideline 05 § State restoration), never past a launch gate or session check.
 */
@Composable
fun AppNavHost(modifier: Modifier = Modifier) {
    val backStack = rememberNavBackStack(HomeKey)
    NavDisplay(
        backStack = backStack,
        modifier = modifier.safeDrawingPadding(),
        onBack = { backStack.removeLastOrNull() },
        entryDecorators =
            listOf(
                rememberSaveableStateHolderNavEntryDecorator(),
                rememberViewModelStoreNavEntryDecorator(),
            ),
        entryProvider =
            entryProvider {
                entry<HomeKey> { HomeScreen() }
            },
    )
}
