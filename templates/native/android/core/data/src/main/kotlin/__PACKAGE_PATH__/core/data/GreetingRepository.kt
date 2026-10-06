package {{PACKAGE}}.core.data

import {{PACKAGE}}.core.network.AppError
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject

/** Sample repository: replace it with the first real one. Repositories expose domain models, never DTOs (guideline 05). */
interface GreetingRepository {
    suspend fun greeting(): Result<String>
}

/** Thrown inside a failed [Result] so callers can map it to [AppError]. */
class AppException(
    val error: AppError,
) : Exception(error.toString())

class DefaultGreetingRepository
    @Inject
    constructor() : GreetingRepository {
        override suspend fun greeting(): Result<String> = Result.success("Hello from {{APP_NAME}}")
    }

@Module
@InstallIn(SingletonComponent::class)
interface DataModule {
    @Binds
    fun bindGreetingRepository(impl: DefaultGreetingRepository): GreetingRepository
}
