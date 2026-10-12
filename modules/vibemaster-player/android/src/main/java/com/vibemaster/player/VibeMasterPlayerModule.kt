package com.vibemaster.player

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class VibeMasterPlayerModule : Module() {
    private var controller: MediaController? = null
    private var controllerFuture: com.google.common.util.concurrent.ListenableFuture<MediaController>? = null

    override fun definition() = ModuleDefinition {
        Name("VibeMasterPlayer")
        Events("playbackStateChanged")

        AsyncFunction("play") { uri: String, title: String, artist: String ->
            val player = getController()
            val metadata = MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .build()
            player.setMediaItem(MediaItem.Builder().setUri(uri).setMediaMetadata(metadata).build())
            player.prepare()
            player.play()
            true
        }

        AsyncFunction("setQueue") { tracks: List<Map<String, String>>, startIndex: Int ->
            require(tracks.isNotEmpty()) { "Queue cannot be empty" }
            val mediaItems = tracks.map { track ->
                val uri = requireNotNull(track["uri"]) { "Each queue item needs a uri" }
                val metadata = MediaMetadata.Builder()
                    .setTitle(track["title"].orEmpty())
                    .setArtist(track["artist"].orEmpty())
                    .build()
                MediaItem.Builder().setUri(uri).setMediaMetadata(metadata).build()
            }
            val player = getController()
            val safeIndex = startIndex.coerceIn(0, mediaItems.lastIndex)
            player.setMediaItems(mediaItems, safeIndex, 0L)
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
        AsyncFunction("getState") {
            val player = getController()
            mapOf(
                "isPlaying" to player.isPlaying,
                "positionMs" to player.currentPosition,
                "durationMs" to player.duration.coerceAtLeast(0L),
                "currentIndex" to player.currentMediaItemIndex,
                "title" to player.mediaMetadata.title?.toString().orEmpty(),
                "artist" to player.mediaMetadata.artist?.toString().orEmpty(),
            )
        }
        OnDestroy {
            controller?.removeListener(playerListener)
            controllerFuture?.cancel(true)
            controller = null
            controllerFuture = null
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            sendEvent("playbackStateChanged", mapOf("isPlaying" to isPlaying))
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
            sendEvent(
                "playbackStateChanged",
                mapOf(
                    "playbackState" to playbackState,
                    "isPlaying" to (controller?.isPlaying ?: false),
                ),
            )
        }
    }

    private fun getController(): MediaController {
        controller?.let { return it }
        val context: Context = requireNotNull(appContext.reactContext) {
            "React context is not available"
        }
        val token = SessionToken(context, ComponentName(context, VibeMasterPlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        controllerFuture = future
        val created = future.get(10, TimeUnit.SECONDS)
        created.addListener(playerListener)
        controller = created
        return created
    }
}
