package com.vibemaster.player

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class VibeMasterPlayerModule : Module() {
    @Volatile private var controller: MediaController? = null
    @Volatile private var controllerFuture: ListenableFuture<MediaController>? = null

    override fun definition() = ModuleDefinition {
        Name("VibeMasterPlayer")
        Events("playbackStateChanged")

        AsyncFunction("resolveTrack") Coroutine { videoId: String ->
            val context = requireNotNull(appContext.reactContext) { "React context is not available" }
            YouTubeStreamResolver.initialize(context)
            val stream = YouTubeStreamResolver.resolve(videoId)
            mapOf(
                "videoId" to stream.videoId,
                "url" to stream.url,
                "mimeType" to stream.mimeType,
                "bitrate" to stream.bitrate,
                "clientName" to stream.clientName,
                "headers" to stream.headers,
            )
        }

        AsyncFunction("play") Coroutine { uri: String, title: String, artist: String, mimeType: String?, headers: Map<String, String>? ->
            val player = getController()
            player.setMediaItem(createMediaItem(uri, title, artist, mimeType, headers.orEmpty()))
            player.prepare()
            player.play()
            true
        }

        AsyncFunction("setQueue") Coroutine { tracks: List<Map<String, Any?>>, startIndex: Int ->
            require(tracks.isNotEmpty()) { "Queue cannot be empty" }
            val sources = tracks.map { track ->
                val uri = requireNotNull(track["uri"] as? String) { "Each queue item needs a uri" }
                createMediaItem(
                    uri,
                    track["title"] as? String ?: "",
                    track["artist"] as? String ?: "",
                    track["mimeType"] as? String,
                    stringMap(track["headers"]),
                )
            }
            val player = getController()
            player.setMediaItems(sources, startIndex.coerceIn(0, sources.lastIndex), 0L)
            player.prepare()
            player.play()
            true
        }

        AsyncFunction("pause") Coroutine { getController().pause(); true }
        AsyncFunction("resume") Coroutine { getController().play(); true }
        AsyncFunction("seekTo") Coroutine { positionMs: Double ->
            getController().seekTo(positionMs.toLong().coerceAtLeast(0L))
            true
        }
        AsyncFunction("skipNext") Coroutine {
            val player = getController()
            if (player.hasNextMediaItem()) player.seekToNextMediaItem()
            true
        }
        AsyncFunction("skipPrevious") Coroutine {
            val player = getController()
            if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem() else player.seekTo(0L)
            true
        }
        AsyncFunction("stop") Coroutine { getController().stop(); true }
        AsyncFunction("setVolume") Coroutine { volume: Double ->
            getController().volume = volume.toFloat().coerceIn(0f, 1f)
            true
        }
        AsyncFunction("getState") Coroutine {
            val player = getController()
            mapOf(
                "isPlaying" to player.isPlaying,
                "positionMs" to player.currentPosition,
                "durationMs" to player.duration.coerceAtLeast(0L),
                "currentIndex" to player.currentMediaItemIndex,
                "title" to player.mediaMetadata.title?.toString().orEmpty(),
                "artist" to player.mediaMetadata.artist?.toString().orEmpty(),
                "playbackState" to player.playbackState,
            )
        }
        OnDestroy {
            controller?.removeListener(playerListener)
            controllerFuture?.cancel(true)
            controller = null
            controllerFuture = null
        }
    }

    private fun createMediaItem(
        uri: String,
        title: String,
        artist: String,
        mimeType: String?,
        headers: Map<String, String>,
    ): MediaItem {
        val metadata = MediaMetadata.Builder().setTitle(title).setArtist(artist).build()
        val builder = MediaItem.Builder().setUri(uri).setMediaMetadata(metadata)
        if (!mimeType.isNullOrBlank()) builder.setMimeType(mimeType)
        val extras = Bundle().apply {
            headers.forEach { (name, value) -> putString("vibemaster.header.$name", value) }
        }
        builder.setRequestMetadata(
            MediaItem.RequestMetadata.Builder()
                .setMediaUri(Uri.parse(uri))
                .setExtras(extras)
                .build(),
        )
        return builder.build()
    }

    private fun stringMap(value: Any?): Map<String, String> {
        val input = value as? Map<*, *> ?: return emptyMap()
        return input.mapNotNull { (key, item) ->
            val name = key as? String
            val headerValue = item as? String
            if (name != null && headerValue != null) name to headerValue else null
        }.toMap()
    }

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            sendEvent("playbackStateChanged", stateMap(controller, isPlaying))
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            sendEvent(
                "playbackStateChanged",
                mapOf(
                    "title" to mediaItem?.mediaMetadata?.title?.toString().orEmpty(),
                    "artist" to mediaItem?.mediaMetadata?.artist?.toString().orEmpty(),
                    "currentIndex" to (controller?.currentMediaItemIndex ?: 0),
                ),
            )
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            sendEvent("playbackStateChanged", stateMap(controller, controller?.isPlaying ?: false))
        }
    }

    private fun stateMap(player: Player?, isPlaying: Boolean) = mapOf(
        "playbackState" to (player?.playbackState ?: Player.STATE_IDLE),
        "isPlaying" to isPlaying,
        "positionMs" to (player?.currentPosition ?: 0L),
        "durationMs" to (player?.duration?.coerceAtLeast(0L) ?: 0L),
        "currentIndex" to (player?.currentMediaItemIndex ?: 0),
        "title" to player?.mediaMetadata?.title?.toString().orEmpty(),
        "artist" to player?.mediaMetadata?.artist?.toString().orEmpty(),
    )

    private suspend fun getController(): MediaController = withContext(Dispatchers.IO) {
        controller?.let { return@withContext it }
        val context: Context = requireNotNull(appContext.reactContext) {
            "React context is not available"
        }
        val token = SessionToken(context, ComponentName(context, VibeMasterPlaybackService::class.java))
        val future = synchronized(this@VibeMasterPlayerModule) {
            controller?.let { return@withContext it }
            controllerFuture ?: MediaController.Builder(context, token).buildAsync().also {
                controllerFuture = it
            }
        }
        val created = try {
            future.get(20, TimeUnit.SECONDS)
        } catch (error: Exception) {
            future.cancel(true)
            synchronized(this@VibeMasterPlayerModule) {
                if (controllerFuture === future) controllerFuture = null
            }
            throw IllegalStateException("Unable to connect to VibeMaster playback service: ${error.message ?: error.javaClass.simpleName}", error)
        }
        synchronized(this@VibeMasterPlayerModule) {
            val existing = controller
            if (existing != null) {
                if (created !== existing) created.release()
                existing
            } else {
                created.addListener(playerListener)
                controller = created
                created
            }
        }
    }
}
