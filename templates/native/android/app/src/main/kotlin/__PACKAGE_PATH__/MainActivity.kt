package {{PACKAGE}}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import {{PACKAGE}}.core.designsystem.AppTheme
import {{PACKAGE}}.navigation.AppNavHost
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                // testTagsAsResourceId: Maestro / UI Automator see testTags as ids. Set it again inside Dialogs/sheets.
                Surface(modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }) {
                    AppNavHost()
                }
            }
        }
    }
}
