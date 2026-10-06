package {{PACKAGE}}.core.analytics

import android.util.Log
import {{PACKAGE}}.core.analytics.generated.AnalyticsEvent
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import org.json.JSONObject
import javax.inject.Inject

/** Sends events generated from contracts/analytics/events.json (`AnalyticsEvent`, in generated/). */
interface Analytics {
    fun track(event: AnalyticsEvent)
}

/**
 * Debug sink for the analytics parity check (guideline 10 § Analytics diff):
 * every event is logged as one `ANALYTICS {json}` line (logcat tag "analytics").
 */
class LogcatAnalytics
    @Inject
    constructor() : Analytics {
        override fun track(event: AnalyticsEvent) {
            val json = JSONObject().put("name", event.name).put("props", JSONObject(event.properties))
            Log.i("analytics", "ANALYTICS $json")
        }
    }

@Module
@InstallIn(SingletonComponent::class)
interface AnalyticsModule {
    @Binds
    fun bindAnalytics(impl: LogcatAnalytics): Analytics
}
