package {{PACKAGE}}.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Design tokens. Generated from contracts/design-tokens once the design file exists (guideline 08); placeholders until then. */
object Spacing {
    val s = 8.dp
    val m = 16.dp
    val l = 24.dp
}

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme(), content = content)
}

/** Keeps running text readable on large screens (ADR-0017): content is centred and capped in width. */
fun Modifier.readableWidth(maxWidth: Dp = 640.dp): Modifier = fillMaxWidth().wrapContentWidth().widthIn(max = maxWidth)
