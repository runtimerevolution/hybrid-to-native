package {{PACKAGE}}.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import {{PACKAGE}}.core.data.GreetingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel
    @Inject
    constructor(
        private val repository: GreetingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(HomeUiState())
        val state: StateFlow<HomeUiState> = _state.asStateFlow()
        private val _effects = Channel<HomeEffect>(Channel.BUFFERED)
        val effects: Flow<HomeEffect> = _effects.receiveAsFlow()
        private var didLoad = false
        private var loadJob: Job? = null

        fun onAction(action: HomeAction) {
            when (action) {
                // idempotent: LaunchedEffect runs again after configuration changes
                HomeAction.Appeared -> {
                    if (!didLoad) {
                        didLoad = true
                        load()
                    }
                }

                HomeAction.RefreshTapped -> {
                    load()
                    _effects.trySend(HomeEffect.ScrollToTop)
                }
            }
        }

        private fun load() {
            loadJob?.cancel()
            loadJob =
                viewModelScope.launch {
                    _state.update { it.copy(isLoading = true) }
                    val greeting = repository.greeting().getOrNull()
                    _state.update { it.copy(isLoading = false, greeting = greeting ?: it.greeting) }
                }
        }
    }
