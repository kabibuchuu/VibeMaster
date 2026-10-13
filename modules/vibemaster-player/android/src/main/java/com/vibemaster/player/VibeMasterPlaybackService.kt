package com.vibemaster.player

import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.MediaSourceFactory
import androidx.media3.common.MediaItem
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Single owner for playback. The MediaSession allows Android's media controls
 * to bind to the same ExoPlayer when the JS UI is backgrounded.
 */
class VibeMasterPlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36")
            .setDefaultRequestProperties(mapOf("Referer" to "https://www.youtube.com/"))
        val fallbackFactory = DefaultMediaSourceFactory(DefaultDataSource.Factory(this, httpFactory))
        val mediaSourceFactory = object : MediaSourceFactory by fallbackFactory {
            override fun createMediaSource(mediaItem: MediaItem): MediaSource {
                val extras = mediaItem.requestMetadata.extras
                val headers = extras?.keySet()?.mapNotNull { key ->
                    if (!key.startsWith("vibemaster.header.")) null
                    else extras.getString(key)?.let { key.removePrefix("vibemaster.header.") to it }
                }?.toMap().orEmpty()
                val userAgent = headers.entries.firstOrNull { it.key.equals("User-Agent", ignoreCase = true) }?.value
                    ?: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
                val requestHeaders = linkedMapOf("Referer" to "https://www.youtube.com/")
                headers.forEach { (key, value) ->
                    if (!key.equals("User-Agent", ignoreCase = true)) requestHeaders[key] = value
                }
                val perItemHttpFactory = DefaultHttpDataSource.Factory()
                    .setUserAgent(userAgent)
                    .setDefaultRequestProperties(requestHeaders)
                return DefaultMediaSourceFactory(
                    DefaultDataSource.Factory(this@VibeMasterPlaybackService, perItemHttpFactory),
                ).createMediaSource(mediaItem)
            }
        }
        val player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(mediaSourceFactory)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true,
            )
            .setHandleAudioBecomingNoisy(true)
            .build()
        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
        }
        mediaSession = null
        super.onDestroy()
    }
}
