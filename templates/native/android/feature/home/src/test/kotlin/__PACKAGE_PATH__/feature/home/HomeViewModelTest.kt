package {{PACKAGE}}.feature.home

import {{PACKAGE}}.core.data.GreetingRepository
import {{PACKAGE}}.core.testing.MainDispatcherRule
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class FakeGreetingRepository(
    private val result: Result<String> = Result.success("Hi"),
) : GreetingRepository {
    var calls = 0

    override suspend fun greeting(): Result<String> {
        calls++
        return result
    }
}

class HomeViewModelTest {
    @get:Rule val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `appeared loads the greeting once`() =
        runTest {
            val repository = FakeGreetingRepository()
            val viewModel = HomeViewModel(repository)
            viewModel.onAction(HomeAction.Appeared)
            viewModel.onAction(HomeAction.Appeared)
            assertEquals("Hi", viewModel.state.value.greeting)
            assertEquals(1, repository.calls)
        }
}
