package {{PACKAGE}}.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import {{PACKAGE}}.core.designsystem.AppTheme
import {{PACKAGE}}.core.designsystem.Spacing
import {{PACKAGE}}.core.designsystem.readableWidth
import {{PACKAGE}}.core.designsystem.R as DesignR

/** Gets the view model, collects state and effects. All drawing happens in [HomeContent]. */
@Composable
fun HomeScreen(viewModel: HomeViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.onAction(HomeAction.Appeared)
        viewModel.effects.collect { effect ->
            when (effect) {
                HomeEffect.ScrollToTop -> Unit // a real screen scrolls its list here
            }
        }
    }
    HomeContent(state = state, onAction = viewModel::onAction)
}

/** Stateless: state in, actions out. Previews and screenshot tests use it with fixture states. */
@Composable
fun HomeContent(
    state: HomeUiState,
    onAction: (HomeAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.l).testTag("home.root"),
        verticalArrangement = Arrangement.spacedBy(Spacing.m, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (state.isLoading) CircularProgressIndicator(modifier = Modifier.testTag("home.loading"))
        Text(
            text = state.greeting,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.readableWidth().testTag("home.greeting"),
        )
        Button(onClick = { onAction(HomeAction.RefreshTapped) }, modifier = Modifier.testTag("home.refreshButton")) {
            Text(stringResource(DesignR.string.common_refresh))
        }
    }
}

@Preview
@Composable
private fun HomeContentPreview() {
    AppTheme { HomeContent(state = HomeUiState(greeting = "Hello"), onAction = {}) }
}
