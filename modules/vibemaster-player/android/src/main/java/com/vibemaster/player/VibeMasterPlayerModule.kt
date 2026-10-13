package com.vibemaster.player

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class VibeMasterPlayerModule : Module() {
    private var controller: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null

    override fun definition() = ModuleDefinition {
        Name("VibeMasterPlayer")
        Events("playbackStateChanged")

        AsyncFunction("resolveTrack") Coroutine { videoId: String ->
            val context = requireNotNull(appContext.reactContext) {
                "React context is not available"
            }
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

        AsyncFunction("play") { uri: String, title: String, artist: String, mimeType: String?, headers: Map<String, String>? ->
            val context = requireNotNull(appContext.reactContext) { "React context is not available" }
            val player = getController()
            val item = createMediaItem(uri, title, artist, mimeType)
            player.setMediaItem(item)
            player.prepare()
            player.play()
            true
        }

        AsyncFunction("setQueue") { tracks: List<Map<String, Any?>>, startIndex: Int ->
            require(tracks.isNotEmpty()) { "Queue cannot be empty" }
            val context = requireNotNull(appContext.reactContext) { "React context is not available" }
            val sources = tracks.map { track ->
                val uri = requireNotNull(track["uri"] as? String) { "Each queue item needs a uri" }
                val title = track["title"] as? String ?: ""
                val artist = track["artist"] as? String ?: ""
                val mimeType = track["mimeType"] as? String
                val headers = stringMap(track["headers"])
                createMediaItem(uri, title, artist, mimeType)
            }
            val player = getController()
            val safeIndex = startIndex.coerceIn(0, sources.lastIndex)
            player.setMediaItems(sources, safeIndex, 0L)
            player.prepare()
            player.play()
            true
        }

        AsyncFunction("pause") { getController().pause(); true }
        AsyncFunction("resume") { getController().play(); true }
        AsyncFunction("seekTo") { positionMs: Double ->
            getController().seekTo(positionMs.toLong().coerceAtLeast(0L))
            true
        }
        AsyncFunction("skipNext") {
            val player = getController()
            if (player.hasNextMediaItem()) player.seekToNextMediaItem()
            true
        }
        AsyncFunction("skipPrevious") {
            val player = getController()
            if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem()
            else player.seekTo(0L)
            true
        }
        AsyncFunction("stop") { getController().stop(); true }
        AsyncFunction("setVolume") { volume: Double ->
            getController().volume = volume.toFloat().coerceIn(0f, 1f)
            true
        }
        AsyncFunction("getState") {
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
    ): MediaItem {
        val metadata = MediaMetadata.Builder().setTitle(title).setArtist(artist).build()
        val builder = MediaItem.Builder().setUri(uri).setMediaMetadata(metadata)
        if (!mimeType.isNullOrBlank()) builder.setMimeType(mimeType)
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
            val player = controller
            sendEvent("playbackStateChanged", stateMap(player, isPlaying))
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            sendEvent(
                "playbackStateChanged",
                mapOf(
                    "title" to (mediaItem?.mediaMetadata?.title?.toString().orEmpty()),
                    "artist" to (mediaItem?.mediaMetadata?.artist?.toString().orEmpty()),
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
        "title" to (player?.mediaMetadata?.title?.toString().orEmpty()),
        "artist" to (player?.mediaMetadata?.artist?.toString().orEmpty()),
    )

    private fun getController(): MediaController {
        controller?.let { return it }
        val context: Context = requireNotNull(appContext.reactContext) {
            "React context is not available"
        }
        val token = SessionToken(context, ComponentName(context, VibeMasterPlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        controllerFuture = future
        val created = try {
            future.get(10, TimeUnit.SECONDS)
        } catch (error: Exception) {
            future.cancel(true)
            controllerFuture = null
            throw IllegalStateException("Unable to connect to VibeMaster playback service", error)
        }
        created.addListener(playerListener)
        controller = created
        return created
    }
}
