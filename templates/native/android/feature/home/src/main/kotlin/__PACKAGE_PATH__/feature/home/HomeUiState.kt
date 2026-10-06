package {{PACKAGE}}.feature.home

/** Sample feature in the kit's pattern (guideline 05): replace it with the first real feature. */
data class HomeUiState(
    val greeting: String = "",
    val isLoading: Boolean = false,
)

sealed interface HomeAction {
    data object Appeared : HomeAction

    data object RefreshTapped : HomeAction
}

sealed interface HomeEffect {
    data object ScrollToTop : HomeEffect
}
