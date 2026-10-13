package com.vibemaster.player

import android.content.Context
import com.metrolist.innertubex.InnerTube
import com.metrolist.innertubex.cipher.PlayerConfigRepository
import com.metrolist.innertubex.cipher.RemotePlayerConfigStore
import com.metrolist.innertubex.cipher.YouTubeCipherService
import com.metrolist.innertubex.extraction.AudioQuality
import com.metrolist.innertubex.extraction.ContentHints
import com.metrolist.innertubex.extraction.InnerTubeExtractor
import com.metrolist.innertubex.extraction.PoTokenResult
import com.metrolist.innertubex.extraction.TokenProvider
import com.metrolist.innertubex.extraction.TokenProviderCapabilities
import com.metrolist.innertubex.extraction.YtConfigParserImpl
import com.metrolist.innertubex.extraction.generateClientPlaybackNonce
import com.metrolist.innertubex.models.YouTubeLocale
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import java.util.concurrent.atomic.AtomicReference

/**
 * Small VibeMaster adapter around the GPL-3.0 InnerTubeX library used by
 * Metrolist and BitChord. Catalog search stays in TypeScript; this adapter
 * resolves a selected video ID into a short-lived audio URI.
 *
 * This first pass does not mint PoTokens or supply account cookies, so some
 * source responses may be unavailable. No full-track coverage is claimed
 * before Android device testing.
 */
internal object YouTubeStreamResolver {
    data class ResolvedStream(
        val videoId: String,
        val url: String,
        val mimeType: String,
        val bitrate: Int,
        val clientName: String,
        val headers: Map<String, String>,
    )

    private const val PLAYER_CONFIG_URL =
        "https://raw.githubusercontent.com/ZemerTeam/zemer-cipher/master/library/src/main/assets/player_configs.json"

    private val contextRef = AtomicReference<Context?>()
    @Volatile private var extractor: InnerTubeExtractor? = null

    fun initialize(context: Context) {
        contextRef.compareAndSet(null, context.applicationContext)
    }

    private fun buildExtractor(): InnerTubeExtractor {
        extractor?.let { return it }
        synchronized(this) {
            extractor?.let { return it }
            val context = requireNotNull(contextRef.get()) { "VibeMaster player module is not initialized" }
            val http = HttpClient(OkHttp) {
                expectSuccess = false
                install(ContentNegotiation) {
                    json(Json {
                        ignoreUnknownKeys = true
                        explicitNulls = false
                        encodeDefaults = true
                    })
                }
                install(HttpTimeout) {
                    requestTimeoutMillis = 30000
                    connectTimeoutMillis = 15000
                    socketTimeoutMillis = 20000
                }
            }
            val preferences = context.getSharedPreferences("vibemaster_innertubex", Context.MODE_PRIVATE)
            val repository = object : PlayerConfigRepository {
                override val enabled: Boolean = true
                override val sourceUrl: String = PLAYER_CONFIG_URL
                override val defaultSourceUrl: String = PLAYER_CONFIG_URL
                override var cachedJson: String
                    get() = preferences.getString("json", "").orEmpty()
                    set(value) { preferences.edit().putString("json", value).apply() }
                override var cachedAtMs: Long
                    get() = preferences.getLong("cached_at_ms", 0L)
                    set(value) { preferences.edit().putLong("cached_at_ms", value).apply() }
                override var cachedSourceUrl: String
                    get() = preferences.getString("source_url", "").orEmpty()
                    set(value) { preferences.edit().putString("source_url", value).apply() }
                override var cachedEtag: String
                    get() = preferences.getString("etag", "").orEmpty()
                    set(value) { preferences.edit().putString("etag", value).apply() }
            }
            val innerTube = InnerTube(http)
            innerTube.locale = YouTubeLocale(gl = "US", hl = "en")
            val remoteStore = RemotePlayerConfigStore(http, repository)
            val cipher = YouTubeCipherService(http, remoteStore)
            val tokenProvider = object : TokenProvider {
                override val capabilities: TokenProviderCapabilities = TokenProviderCapabilities()
                override suspend fun getPoToken(
                    videoId: String,
                    visitorData: String,
                    cookie: String?,
                ): PoTokenResult? = null
            }
            return InnerTubeExtractor(
                configParser = YtConfigParserImpl(http, innerTube, remoteStore),
                cipherService = cipher,
                innerTube = innerTube,
                tokenProvider = tokenProvider,
            ).also { extractor = it }
        }
    }

    suspend fun resolve(videoId: String): ResolvedStream {
        require(videoId.matches(Regex("[A-Za-z0-9_-]{11}"))) { "Invalid YouTube video ID" }
        val stream = requireNotNull(
            buildExtractor().extract(
                videoId = videoId,
                hints = ContentHints().withStreamCapabilities(
                    allowHls = false,
                    allowSabr = false,
                    allowBoundedRange = false,
                ),
                audioQuality = AudioQuality.AUTO,
                clientPlaybackNonce = generateClientPlaybackNonce(),
            ),
        ) { "No playable audio stream was returned by the source" }

        check(stream.sabrBootstrap == null) { "This player build does not support the selected stream transport" }
        val mime = stream.mimeType.orEmpty()
        return ResolvedStream(
            videoId = videoId,
            url = stream.audioUrl,
            mimeType = mime,
            bitrate = stream.bitrate ?: 0,
            clientName = stream.clientName,
            headers = stream.headers,
        )
    }
}
