import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import * as Brightness from 'expo-brightness';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { auth } from '../firebase';
import {
  addQueueItem,
  appendQueueItems,
  joinRoom,
  leaveRoom,
  moveQueueItem,
  removeQueueItem,
  setController,
  sendMessage,
  setCurrentItem,
  updatePlayback,
  watchMessages,
  watchParticipants,
  watchRoom,
} from '../src/lib/roomRepository';
import { getPlaylistItems } from '../src/lib/youtube';
import type { Participant, QueueItem, Room, RoomMessage } from '../src/types/room';

type PlayerMessage =
  | { type: 'ready' }
  | { type: 'state'; state: number; position: number }
  | { type: 'seek'; position: number }
  | { type: 'progress'; position: number; duration: number }
  | { type: 'error'; code: number }
  | { type: 'autoplayBlocked' };

const DRIFT_TOLERANCE_SECONDS = 0.75;
const APP_ORIGIN = 'https://com.vibemaster.app';
const APP_REFERRER = APP_ORIGIN + '/';

const PLAYER_ERROR_TEXT: Record<number, string> = {
  2: 'YouTube rejected this video ID. Try another result.',
  5: 'This video cannot be played in the embedded player.',
  100: 'This video was removed or is private.',
  101: 'The owner does not allow this video to be embedded.',
  150: 'The owner does not allow this video to be embedded.',
  153: 'YouTube did not receive the app referrer required for embedded playback.',
};

function playerHtml(videoId: string) {
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  return [
    '<!doctype html><html><head>',
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">',
    '<meta name="referrer" content="origin">',
    '<style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}body{font-family:sans-serif}</style>',
    '</head><body><div id="player"></div><script>',
    'var vmPlayer=null;',
    'function send(m){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(m));}}',
    'function onYouTubeIframeAPIReady(){',
    'vmPlayer=new YT.Player("player",{',
    'width:"100%",height:"100%",videoId:"' + safeId + '",',
    'playerVars:{playsinline:1,controls:0,disablekb:1,rel:0,fs:0,iv_load_policy:3,enablejsapi:1,origin:"' + APP_ORIGIN + '",widget_referrer:"' + APP_REFERRER + '"},',
    'events:{',
    'onReady:function(){send({type:"ready"});setInterval(function(){if(vmPlayer){send({type:"progress",position:Number(vmPlayer.getCurrentTime()||0),duration:Number(vmPlayer.getDuration()||0)});}},500);},',
    'onError:function(e){send({type:"error",code:e.data});},',
    'onAutoplayBlocked:function(){send({type:"autoplayBlocked"});},',
    'onStateChange:function(e){if(vmPlayer){send({type:"state",state:e.data,position:Number(vmPlayer.getCurrentTime()||0)});}}',
    '}});',
    '}',
    '</script><script src="https://www.youtube.com/iframe_api"></script></body></html>',
  ].join('');
}

export default function RoomScreen() {
  const {
    code,
    videoId,
    playlistId,
    title,
    channel,
    thumbnail,
    kind,
    duration,
  } = useLocalSearchParams<{
    code: string;
    videoId?: string;
    playlistId?: string;
    title?: string;
    channel?: string;
    thumbnail?: string;
    kind?: 'music' | 'video';
    duration?: string;
  }>();

  const roomCode = String(code ?? '').trim().toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [name, setName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [playerPosition, setPlayerPosition] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(0.7);
  const [fullscreenPlayerReady, setFullscreenPlayerReady] = useState(false);
  const playerRef = useRef<WebView>(null);
  const fullscreenPlayerRef = useRef<WebView>(null);
  const originalBrightnessRef = useRef<number | null>(null);
  const addedRef = useRef('');
  const isHost = room?.hostId === auth.currentUser?.uid;
  const canControl = Boolean(isHost || (auth.currentUser?.uid && room?.controllerIds?.includes(auth.currentUser.uid)));
  const me = people.find(person => person.id === auth.currentUser?.uid);
  const joined = Boolean(me);
  const current = room?.queue?.find(item => item.id === room.currentItemId) ?? room?.queue?.[0];

  useEffect(() => {
    if (!roomCode) {
      setRoomLoaded(true);
      return;
    }
    return watchRoom(
      roomCode,
      value => {
        setRoom(value);
        setRoomLoaded(true);
        if (!value) setError('Room not found. Check the code and try again.');
      },
      e => setError(e.message),
    );
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    return watchParticipants(roomCode, setPeople, e => setError(e.message));
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    return watchMessages(roomCode, setMessages, e => setError(e.message));
  }, [roomCode]);

  useEffect(() => {
    if (me) setName(me.name);
    if (room && isHost && !me) {
      void joinRoom(roomCode, auth.currentUser?.uid ?? '', 'Host').catch(e =>
        setError(e instanceof Error ? e.message : 'Could not join room.'),
      );
    }
  }, [room, isHost, me, roomCode]);

  useEffect(() => {
    if (!room || !isHost) return;

    if (playlistId && addedRef.current !== String(playlistId)) {
      addedRef.current = String(playlistId);
      void getPlaylistItems(String(playlistId))
        .then(items => {
          if (!items.length) return;
          return appendQueueItems(roomCode, items).then(() => {
            if (!room.currentItemId) return setCurrentItem(roomCode, items[0].id);
          });
        })
        .catch(e => setError(e instanceof Error ? e.message : 'Could not add playlist.'));
      return;
    }

    if (videoId && addedRef.current !== String(videoId)) {
      addedRef.current = String(videoId);
      const item: QueueItem = {
        id: String(videoId),
        videoId: String(videoId),
        title: String(title ?? 'Selected video'),
        channelTitle: String(channel ?? 'YouTube'),
        thumbnail: String(thumbnail ?? ''),
        duration: duration ? String(duration) : undefined,
        kind: kind === 'music' ? 'music' : 'video',
      };
      void addQueueItem(roomCode, item)
        .then(() => {
          if (!room.currentItemId) return setCurrentItem(roomCode, item.id);
        })
        .catch(e => setError(e instanceof Error ? e.message : 'Could not add video.'));
    }
  }, [
    room,
    isHost,
    videoId,
    playlistId,
    title,
    channel,
    thumbnail,
    kind,
    duration,
    roomCode,
  ]);

  useEffect(() => {
    setPlayerReady(false);
    setFullscreenPlayerReady(false);
    setPlayerError(null);
    setAutoplayBlocked(false);
  }, [current?.id]);

  useEffect(() => {
    let mounted = true;
    void Brightness.getBrightnessAsync().then(value => {
      if (mounted) {
        originalBrightnessRef.current = value;
        setBrightness(value);
      }
    }).catch(() => {});
    return () => {
      mounted = false;
      StatusBar.setHidden(false, 'none');
      void ScreenOrientation.unlockAsync().catch(() => {});
      if (originalBrightnessRef.current != null) {
        void Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (fullScreen) {
      setFullscreenPlayerReady(false);
      StatusBar.setHidden(true, 'fade');
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    } else {
      setPlayerReady(false);
      StatusBar.setHidden(false, 'fade');
      void ScreenOrientation.unlockAsync().catch(() => {});
    }
  }, [fullScreen]);

  const syncPlayer = () => {
    const activeRef = fullScreen ? fullscreenPlayerRef : playerRef;
    const activeReady = fullScreen ? fullscreenPlayerReady : playerReady;
    if (!room || !current || !activeReady) return;
    const elapsed = room.status === 'playing'
      ? Math.max(0, (Date.now() - room.updatedAt) / 1000)
      : 0;
    const target = Math.max(0, room.position + elapsed);
    const desiredState = room.status === 'playing' ? 1 : 2;
    const script = [
      'if(window.vmPlayer){',
      'var now=Number(window.vmPlayer.getCurrentTime()||0);',
      'var state=Number(window.vmPlayer.getPlayerState());',
      'var target=' + target + ';',
      'if(Math.abs(now-target)>' + DRIFT_TOLERANCE_SECONDS + ')window.vmPlayer.seekTo(target,true);',
      'if(state!==' + desiredState + '){' + (desiredState === 1 ? 'window.vmPlayer.playVideo();' : 'window.vmPlayer.pauseVideo();') + '}',
      '}true;',
    ].join('');
    activeRef.current?.injectJavaScript(script);
  };

  useEffect(() => {
    if (!room || !current || !playerReady) return;
    syncPlayer();
    if (canControl) return;
    const timer = setInterval(syncPlayer, 2000);
    return () => clearInterval(timer);
  }, [room?.version, room?.status, room?.position, room?.updatedAt, current?.id, playerReady, fullscreenPlayerReady, fullScreen, canControl]);

  async function publish(status: Room['status'], position: number) {
    if (!current || !canControl) return;
    try {
      await updatePlayback(roomCode, {
        status,
        position: Math.max(0, position),
        currentItemId: current.id,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Playback update failed.');
    }
  }

  async function handlePlayerMessage(event: WebViewMessageEvent, isFullscreenPlayer = false) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as PlayerMessage;

      if (message.type === 'ready') {
        if (isFullscreenPlayer) setFullscreenPlayerReady(true);
        else setPlayerReady(true);
        setPlayerError(null);
        return;
      }

      if (message.type === 'progress') {
        setPlayerPosition(Math.max(0, message.position));
        setPlayerDuration(Math.max(0, message.duration));
        return;
      }

      if (message.type === 'error') {
        setPlayerError(message.code);
        return;
      }

      if (message.type === 'autoplayBlocked') {
        setAutoplayBlocked(true);
        return;
      }

      if (!canControl) return;

      if (message.type === 'seek') {
        await publish(room?.status === 'playing' ? 'playing' : 'paused', message.position);
        return;
      }

      if (message.type === 'state') {
        if (message.state === 0) {
          const queue = room?.queue ?? [];
          const index = queue.findIndex(item => item.id === current?.id);
          const next = index >= 0 ? queue[index + 1] : undefined;
          if (next) {
            await setCurrentItem(roomCode, next.id, 'playing', 0);
          } else {
            await publish('paused', message.position);
          }
        } else if (message.state === 1) {
          await publish('playing', message.position);
        } else if (message.state === 2) {
          await publish('paused', message.position);
        }
      }
    } catch {
      // Ignore malformed WebView messages.
    }
  }

  function command(script: string) {
    const activeRef = fullScreen ? fullscreenPlayerRef : playerRef;
    activeRef.current?.injectJavaScript(
      'if(window.vmPlayer){window.vmPlayer.' + script + '}true;',
    );
  }

  function setPlayerVolume(value: number) {
    const next = Math.max(0, Math.min(1, value));
    setVolume(next);
    setMuted(next === 0);
    command('setVolume(' + Math.round(next * 100) + ');');
    if (next > 0) command('unMute();');
  }

  function setScreenBrightness(value: number) {
    const next = Math.max(0.05, Math.min(1, value));
    setBrightness(next);
    void Brightness.setBrightnessAsync(next).catch(() => {});
  }

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    command(nextMuted ? 'mute();' : 'unMute();');
    if (!nextMuted && volume === 0) setPlayerVolume(0.8);
  }

  function seekToFraction(fraction: number) {
    if (!playerReady || !playerDuration || !canControl) return;
    const target = Math.max(0, Math.min(playerDuration, playerDuration * fraction));
    const activeRef = fullScreen ? fullscreenPlayerRef : playerRef;
    activeRef.current?.injectJavaScript(
      'if(window.vmPlayer){window.vmPlayer.seekTo(' + target + ',true);window.ReactNativeWebView.postMessage(JSON.stringify({type:"seek",position:' + target + '}));}true;'
    );
  }

  function formatTime(seconds: number) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return minutes + ':' + secs;
  }

  function seek(delta: number) {
    if (!canControl) return;
    const activeRef = fullScreen ? fullscreenPlayerRef : playerRef;
    activeRef.current?.injectJavaScript(
      'if(window.vmPlayer){' +
      'var target=Math.max(0,Number(window.vmPlayer.getCurrentTime()||0)+' + delta + ');' +
      'window.vmPlayer.seekTo(target,true);' +
      'window.ReactNativeWebView.postMessage(JSON.stringify({type:"seek",position:target}));' +
      '}true;',
    );
  }

  async function selectItem(item: QueueItem) {
    if (!isHost) return;
    try {
      await setCurrentItem(roomCode, item.id, 'paused', 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not select item.');
    }
  }

  async function removeItem(item: QueueItem) {
    if (!isHost || item.id === current?.id) return;
    try {
      await removeQueueItem(roomCode, item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove item.');
    }
  }

  async function moveItem(item: QueueItem, direction: 'up' | 'down') {
    if (!isHost) return;
    try {
      await moveQueueItem(roomCode, item.id, direction);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move item.');
    }
  }

  async function changeTrack(direction: -1 | 1) {
    if (!canControl || !room || !current) return;
    const queue = room.queue ?? [];
    const index = queue.findIndex(item => item.id === current.id);
    if (index < 0) return;
    if (direction < 0 && playerPosition > 8) {
      seekToFraction(0);
      return;
    }
    const next = queue[index + direction];
    if (!next) return;
    try {
      await setCurrentItem(roomCode, next.id, 'playing', 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change track.');
    }
  }

  async function toggleController(userId: string) {
    if (!isHost || userId === auth.currentUser?.uid) return;
    try {
      const enabled = !(room?.controllerIds ?? []).includes(userId);
      await setController(roomCode, userId, enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update room access.');
    }
  }

  async function shareRoom() {
    try {
      await Share.share({
        title: 'Join my VibeMaster room',
        message: 'Join my VibeMaster room: ' + roomCode,
      });
    } catch {
      // Share sheets can be dismissed; no action needed.
    }
  }

  async function submitMessage() {
    const text = messageText.trim().slice(0, 280);
    if (!text || !joined || !auth.currentUser) return;
    try {
      await sendMessage(roomCode, {
        userId: auth.currentUser.uid,
        name: name.trim() || 'Guest',
        text,
      });
      setMessageText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message.');
    }
  }

  async function exitRoom() {
    if (!auth.currentUser || !joined || isHost) return;
    try {
      await leaveRoom(roomCode, auth.currentUser.uid);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave room.');
    }
  }

  const html = useMemo(
    () => current
      ? playerHtml(current.videoId)
      : '<html><body style="margin:0;background:#08070d;color:#777;text-align:center;padding-top:35%;font-family:sans-serif">Add something to start the vibe.</body></html>',
    [current?.id, current?.videoId],
  );

  if (!roomLoaded) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#a78bfa" />
        <Text style={s.muted}>Loading room {roomCode}…</Text>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.big}>Room unavailable</Text>
        <Text style={s.muted}>{error || 'That room does not exist.'}</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={s.primaryBtnText}>Back home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const status = room.status === 'playing' ? 'LIVE' : 'PAUSED';
  const playerErrorText = playerError ? PLAYER_ERROR_TEXT[playerError] ?? 'YouTube could not play this video.' : '';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.c} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{room.mode.toUpperCase()} ROOM</Text>
          <Text style={s.title}>{roomCode}</Text>
        </View>
        <TouchableOpacity style={s.people} onPress={() => (isHost ? setManageOpen(true) : void shareRoom())}>
          <Text style={s.peopleText}>● {people.length}</Text>
        </TouchableOpacity>
      </View>

      {!fullScreen ? (
        <View style={s.player}>
          {current ? (
            <WebView
              key={current.id + '-inline'}
              ref={playerRef}
              pointerEvents="none"
              source={{ html, baseUrl: APP_REFERRER }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              allowsFullscreenVideo={false}
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={request => !/^(intent:|vnd\.youtube:|youtube:|market:)/i.test(request.url)}
              onMessage={event => void handlePlayerMessage(event, false)}
              onHttpError={() => setError('The YouTube player could not load. Check your connection and try again.')}
              startInLoadingState
            />
          ) : (
            <View style={s.emptyPlayer}><Text style={s.emptyPlayerText}>Add something to start the vibe.</Text></View>
          )}
        </View>
      ) : null}

      {current ? (
        <View style={s.playerControlPanel}>
          <View style={s.playerIdentityRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.playerEyebrow}>{room.mode === 'music' ? 'MUSIC' : 'VIDEO'} · {status}</Text>
              <Text numberOfLines={1} style={s.playerTitle}>{current.title}</Text>
              <Text numberOfLines={1} style={s.playerChannel}>{current.channelTitle}</Text>
            </View>
            <TouchableOpacity style={s.iconButton} onPress={() => setSettingsOpen(value => !value)}>
              <Text style={s.iconButtonText}>⚙</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconButton} onPress={() => setFullScreen(true)}>
              <Text style={s.iconButtonText}>⛶</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            disabled={!canControl || !playerDuration}
            onPress={event => {
              if (!progressWidth) return;
              seekToFraction(event.nativeEvent.locationX / progressWidth);
            }}
            onLayout={event => setProgressWidth(event.nativeEvent.layout.width)}
            style={s.progressTrack}
          >
            <View
              style={[
                s.progressFill,
                { width: progressWidth ? Math.min(1, playerPosition / Math.max(1, playerDuration)) * progressWidth : 0 },
              ]}
            />
          </TouchableOpacity>

          <View style={s.playerTimeRow}>
            <Text style={s.playerTime}>{formatTime(playerPosition)} / {formatTime(playerDuration)}</Text>
            <Text style={s.playerAccess}>{canControl ? 'PLAYBACK ACCESS' : 'SYNCED'}</Text>
          </View>

          {canControl ? (
            <View style={s.compactControls}>
              <TouchableOpacity style={s.compactControl} onPress={() => void changeTrack(-1)} disabled={!playerReady && !fullscreenPlayerReady}>
                <Text style={s.compactControlText}>⏮</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.compactControl} onPress={() => seek(-10)} disabled={!playerReady && !fullscreenPlayerReady}>
                <Text style={s.compactControlText}>↶</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.mainPlay, (!playerReady && !fullscreenPlayerReady) && s.disabled]}
                onPress={() => command(room.status === 'playing' ? 'pauseVideo();' : 'playVideo();')}
                disabled={(!playerReady && !fullscreenPlayerReady) || !current}
              >
                <Text style={s.mainPlayText}>{room.status === 'playing' ? 'Ⅱ' : '▶'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.compactControl} onPress={() => seek(10)} disabled={!playerReady && !fullscreenPlayerReady}>
                <Text style={s.compactControlText}>↷</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.compactControl} onPress={() => void changeTrack(1)} disabled={!playerReady && !fullscreenPlayerReady}>
                <Text style={s.compactControlText}>⏭</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {settingsOpen ? (
            <View style={s.settingsPanel}>
              <View style={s.settingRow}>
                <Text style={s.settingLabel}>Volume</Text>
                <Text style={s.settingValue}>{Math.round(volume * 100)}%</Text>
              </View>
              <Slider
                value={volume}
                minimumValue={0}
                maximumValue={1}
                minimumTrackTintColor="#a78bfa"
                maximumTrackTintColor="#3a3544"
                thumbTintColor="#a78bfa"
                onValueChange={setPlayerVolume}
              />
              {current.kind === 'video' ? (
                <>
                  <View style={s.settingRow}>
                    <Text style={s.settingLabel}>Brightness</Text>
                    <Text style={s.settingValue}>{Math.round(brightness * 100)}%</Text>
                  </View>
                  <Slider
                    value={brightness}
                    minimumValue={0.05}
                    maximumValue={1}
                    minimumTrackTintColor="#a78bfa"
                    maximumTrackTintColor="#3a3544"
                    thumbTintColor="#a78bfa"
                    onValueChange={setScreenBrightness}
                  />
                </>
              ) : null}
              <View style={s.settingButtons}>
                <TouchableOpacity style={s.settingButton} onPress={toggleMute}>
                  <Text style={s.settingButtonText}>{muted ? 'Unmute' : 'Mute'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.settingButton} onPress={() => setFullScreen(true)}>
                  <Text style={s.settingButtonText}>Fullscreen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      ) : null
      {playerError ? (
        <View style={s.error}>
          <Text style={s.errorTitle}>YouTube player error {playerError}</Text>
          <Text style={s.errorText}>{playerErrorText}</Text>
          <TouchableOpacity
            style={s.retry}
            onPress={() => {
              setPlayerError(null);
              playerRef.current?.reload();
            }}
          >
            <Text style={s.retryText}>Reload player</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <TouchableOpacity style={s.error} onPress={() => setError('')}>
          <Text style={s.errorText}>{error}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={s.now}>
        <View style={{ flex: 1 }}>
          <Text style={s.nowKicker}>NOW PLAYING</Text>
          {current ? (
            <>
              <Text numberOfLines={2} style={s.nowTitle}>{current.title}</Text>
              <Text style={s.channel}>{current.channelTitle}</Text>
            </>
          ) : (
            <Text style={s.muted}>Nothing queued yet</Text>
          )}
        </View>
        <Text style={s.live}>{status}</Text>
      </View>

      {!canControl ? (
        <View style={s.viewerHint}>
          <Text style={s.viewerHintText}>{room.status === 'playing' ? 'SYNCED WITH ROOM' : 'ROOM PAUSED'}</Text>
        </View>
      ) : null}

      {!isHost && !joined ? (
        <View style={s.joinCard}>
          <Text style={s.joinTitle}>Join this vibe</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your display name"
            placeholderTextColor="#66636e"
            maxLength={32}
            style={s.nameInput}
            onSubmitEditing={() => {
              if (name.trim() && auth.currentUser) {
                void joinRoom(roomCode, auth.currentUser.uid, name.trim())
                  .catch(e => setError(e instanceof Error ? e.message : 'Could not join room.'));
              }
            }}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={s.joinBtn}
            onPress={() => {
              if (!name.trim() || !auth.currentUser) {
                setError('Enter a display name first.');
                return;
              }
              void joinRoom(roomCode, auth.currentUser.uid, name.trim())
                .catch(e => setError(e instanceof Error ? e.message : 'Could not join room.'));
            }}
          >
            <Text style={s.joinBtnText}>Join room</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {autoplayBlocked && joined ? (
        <TouchableOpacity
          style={s.syncBtn}
          onPress={() => {
            setAutoplayBlocked(false);
            syncPlayer();
          }}
        >
          <Text style={s.syncBtnText}>Tap to sync playback</Text>
        </TouchableOpacity>
      ) : null}

      <View style={s.queueHead}>
        <Text style={s.section}>UP NEXT · {Math.max(0, room.queue.length - (current ? 1 : 0))}</Text>
        <View style={s.queueActions}>
          {joined ? (
            <TouchableOpacity onPress={() => setChatOpen(value => !value)}>
              <Text style={s.chatToggle}>{chatOpen ? 'Hide chat' : 'Chat'}</Text>
            </TouchableOpacity>
          ) : null}
          {isHost ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/search',
                  params: { kind: room.mode === 'music' ? 'music' : 'all', roomCode },
                })
              }
            >
              <Text style={s.add}>＋ Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.queue} keyboardShouldPersistTaps="handled">
        {room.queue.filter(item => item.id !== current?.id).map((item, index) => (
          <View key={item.id} style={[s.queueItem, item.id === current?.id && s.currentQueueItem]}>
            <TouchableOpacity style={s.queueMain} onPress={() => void selectItem(item)} disabled={!isHost}>
              <Image source={{ uri: item.thumbnail }} style={s.qThumb} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={s.qTitle}>{index + 1}. {item.title}</Text>
                <Text style={s.qMeta}>
                  {item.channelTitle}{item.duration ? ' · ' + item.duration : ''}
                </Text>
              </View>
            </TouchableOpacity>
            {isHost ? (
              <View style={s.itemActions}>
                <TouchableOpacity onPress={() => void moveItem(item, 'up')}>
                  <Text style={s.itemAction}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void moveItem(item, 'down')}>
                  <Text style={s.itemAction}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void removeItem(item)}>
                  <Text style={s.itemRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
        {!room.queue.length ? (
          <Text style={s.empty}>Add a song or video to build the queue.</Text>
        ) : null}

        {!isHost && joined ? (
          <TouchableOpacity style={s.leaveBtn} onPress={() => void exitRoom()}>
            <Text style={s.leaveText}>Leave room</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal
        visible={fullScreen && Boolean(current)}
        animationType="fade"
        supportedOrientations={['landscape']}
        onRequestClose={() => setFullScreen(false)}
      >
        <View style={s.fullscreenRoot}>
          <View style={s.fullscreenHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.fullscreenKicker}>{room.mode === 'music' ? 'MUSIC' : 'VIDEO'} · {status}</Text>
              <Text numberOfLines={1} style={s.fullscreenTitle}>{current?.title}</Text>
              <Text numberOfLines={1} style={s.fullscreenChannel}>{current?.channelTitle}</Text>
            </View>
            <TouchableOpacity style={s.fullscreenClose} onPress={() => setFullScreen(false)}>
              <Text style={s.fullscreenCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={s.fullscreenVideo}>
            {current ? (
              <WebView
                key={current.id + '-fullscreen'}
                ref={fullscreenPlayerRef}
                pointerEvents="none"
                source={{ html, baseUrl: APP_REFERRER }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                allowsFullscreenVideo={false}
                mediaPlaybackRequiresUserAction={false}
                setSupportMultipleWindows={false}
                onShouldStartLoadWithRequest={request => !/^(intent:|vnd\.youtube:|youtube:|market:)/i.test(request.url)}
                onMessage={event => void handlePlayerMessage(event, true)}
                onHttpError={() => setError('The YouTube player could not load. Check your connection and try again.')}
                startInLoadingState
              />
            ) : null}
          </View>

          <View style={s.fullscreenControls}>
            <TouchableOpacity style={s.compactControl} onPress={() => void changeTrack(-1)} disabled={!canControl}>
              <Text style={s.compactControlText}>⏮</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.compactControl} onPress={() => seek(-10)} disabled={!canControl}>
              <Text style={s.compactControlText}>↶</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.mainPlay} onPress={() => command(room.status === 'playing' ? 'pauseVideo();' : 'playVideo();')} disabled={!canControl}>
              <Text style={s.mainPlayText}>{room.status === 'playing' ? 'Ⅱ' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.compactControl} onPress={() => seek(10)} disabled={!canControl}>
              <Text style={s.compactControlText}>↷</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.compactControl} onPress={() => void changeTrack(1)} disabled={!canControl}>
              <Text style={s.compactControlText}>⏭</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconButton} onPress={() => setSettingsOpen(value => !value)}>
              <Text style={s.iconButtonText}>⚙</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            disabled={!canControl || !playerDuration}
            onPress={event => {
              if (!progressWidth) return;
              seekToFraction(event.nativeEvent.locationX / progressWidth);
            }}
            onLayout={event => setProgressWidth(event.nativeEvent.layout.width)}
            style={s.fullscreenProgress}
          >
            <View style={[s.progressFill, { width: progressWidth ? Math.min(1, playerPosition / Math.max(1, playerDuration)) * progressWidth : 0 }]} />
          </TouchableOpacity>
          <View style={s.fullscreenTimeRow}>
            <Text style={s.playerTime}>{formatTime(playerPosition)} / {formatTime(playerDuration)}</Text>
            <Text style={s.playerAccess}>{canControl ? 'ROOM CONTROL' : 'SYNCED'}</Text>
          </View>

          {settingsOpen ? (
            <View style={s.fullscreenSettings}>
              <View style={s.settingRow}>
                <Text style={s.settingLabel}>Volume</Text>
                <Text style={s.settingValue}>{Math.round(volume * 100)}%</Text>
              </View>
              <Slider value={volume} minimumValue={0} maximumValue={1} minimumTrackTintColor="#a78bfa" maximumTrackTintColor="#3a3544" thumbTintColor="#a78bfa" onValueChange={setPlayerVolume} />
              {current?.kind === 'video' ? (
                <>
                  <View style={s.settingRow}>
                    <Text style={s.settingLabel}>Brightness</Text>
                    <Text style={s.settingValue}>{Math.round(brightness * 100)}%</Text>
                  </View>
                  <Slider value={brightness} minimumValue={0.05} maximumValue={1} minimumTrackTintColor="#a78bfa" maximumTrackTintColor="#3a3544" thumbTintColor="#a78bfa" onValueChange={setScreenBrightness} />
                </>
              ) : null}
              <TouchableOpacity style={s.settingButton} onPress={toggleMute}>
                <Text style={s.settingButtonText}>{muted ? 'Unmute' : 'Mute'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={chatOpen && joined} transparent animationType="slide" onRequestClose={() => setChatOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={s.chatKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.chatBackdrop}>
            <View style={s.chatSheet}>
              <View style={s.chatHeader}>
                <View>
                  <Text style={s.accessTitle}>Room chat</Text>
                  <Text style={s.accessSub}>{messages.length} messages · live with the room</Text>
                </View>
                <TouchableOpacity onPress={() => setChatOpen(false)} style={s.closeBtn}>
                  <Text style={s.closeText}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={s.messages} contentContainerStyle={s.messageList} keyboardShouldPersistTaps="handled">
                {messages.length ? messages.map(message => (
                  <View key={message.id} style={s.message}>
                    <Text style={s.messageName}>{message.name}</Text>
                    <Text style={s.messageText}>{message.text}</Text>
                  </View>
                )) : (
                  <Text style={s.empty}>Say something to the room.</Text>
                )}
              </ScrollView>
              <View style={s.messageRow}>
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Message the room…"
                  placeholderTextColor="#66636e"
                  maxLength={280}
                  style={s.messageInput}
                  onSubmitEditing={() => void submitMessage()}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={s.sendBtn} onPress={() => void submitMessage()}>
                  <Text style={s.sendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={manageOpen} transparent animationType="slide" onRequestClose={() => setManageOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.accessSheet}>
            <View style={s.accessHeader}>
              <View>
                <Text style={s.accessTitle}>Room controls</Text>
                <Text style={s.accessSub}>Choose who can control playback.</Text>
              </View>
              <TouchableOpacity onPress={() => setManageOpen(false)} style={s.closeBtn}>
                <Text style={s.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.accessList} contentContainerStyle={{ paddingBottom: 10 }}>
              {people.map(person => {
                const owner = person.id === room.hostId;
                const controller = owner || room.controllerIds.includes(person.id);
                return (
                  <View key={person.id} style={s.accessRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.accessName}>{person.name}{owner ? ' · Host' : ''}</Text>
                      <Text style={s.accessRole}>{owner ? 'Full access' : controller ? 'Playback access' : 'Viewer'}</Text>
                    </View>
                    {!owner ? (
                      <TouchableOpacity style={[s.accessToggle, controller && s.accessToggleOn]} onPress={() => void toggleController(person.id)}>
                        <Text style={s.accessToggleText}>{controller ? 'CONTROL ON' : 'ALLOW CONTROL'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.shareRoomBtn} onPress={() => void shareRoom()}>
              <Text style={s.shareRoomText}>Share room code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08070d' },
  c: { flex: 1, backgroundColor: '#08070d', paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: '#08070d', alignItems: 'center', justifyContent: 'center', padding: 24 },
  big: { color: '#fff', fontSize: 26, fontWeight: '900' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingRight: 10 },
  back: { color: '#fff', fontSize: 36, lineHeight: 36 },
  kicker: { color: '#a78bfa', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  people: { backgroundColor: '#15131d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  peopleText: { color: '#c4b5fd', fontWeight: '800' },
  player: { height: 220, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  emptyPlayer: { flex: 1, backgroundColor: '#0b0a10', alignItems: 'center', justifyContent: 'center' },
  emptyPlayerText: { color: '#67636f', fontSize: 12 },
  playerControlPanel: { backgroundColor: '#111019', borderRadius: 18, marginTop: 10, padding: 13, borderWidth: 1, borderColor: '#201d28' },
  playerIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerEyebrow: { color: '#a78bfa', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  playerTitle: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 3 },
  playerChannel: { color: '#777481', fontSize: 11, marginTop: 2 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#201d27', alignItems: 'center', justifyContent: 'center' },
  iconButtonText: { color: '#dcd5e7', fontSize: 19 },
  progressTrack: { height: 5, borderRadius: 5, backgroundColor: '#302b38', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 5, borderRadius: 5, backgroundColor: '#a78bfa' },
  playerTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  playerTime: { color: '#fff', fontSize: 10, fontWeight: '700' },
  playerAccess: { color: '#a78bfa', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  compactControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 10 },
  compactControl: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#201d27', alignItems: 'center', justifyContent: 'center' },
  compactControlText: { color: '#eee', fontSize: 20, fontWeight: '800' },
  mainPlay: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
  mainPlayText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  settingsPanel: { marginTop: 12, backgroundColor: '#0b0a10', borderRadius: 14, padding: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  settingLabel: { color: '#dcd5e7', fontSize: 12, fontWeight: '800' },
  settingValue: { color: '#a78bfa', fontSize: 11, fontWeight: '900' },
  settingButtons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  settingButton: { flex: 1, backgroundColor: '#201d27', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  settingButtonText: { color: '#cfc2ed', fontSize: 11, fontWeight: '900' },
  fullscreenRoot: { flex: 1, backgroundColor: '#050509', paddingHorizontal: 18, paddingVertical: 12 },
  fullscreenHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fullscreenKicker: { color: '#a78bfa', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  fullscreenTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 2 },
  fullscreenChannel: { color: '#777481', fontSize: 11, marginTop: 2 },
  fullscreenClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#201d27', alignItems: 'center', justifyContent: 'center' },
  fullscreenCloseText: { color: '#fff', fontSize: 25, lineHeight: 27 },
  fullscreenVideo: { flex: 1, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' },
  fullscreenControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 9 },
  fullscreenProgress: { height: 5, borderRadius: 5, backgroundColor: '#302b38', overflow: 'hidden' },
  fullscreenTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  fullscreenSettings: { backgroundColor: '#111019', borderRadius: 14, padding: 12, marginTop: 5 },
  error: { backgroundColor: '#35151c', borderRadius: 14, padding: 12, marginTop: 10 },
  errorTitle: { color: '#fff', fontWeight: '800' },
  errorText: { color: '#c99ca5', fontSize: 12, lineHeight: 18, marginTop: 3 },
  retry: { alignSelf: 'flex-start', backgroundColor: '#4a2029', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  now: { flexDirection: 'row', backgroundColor: '#111019', borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#201d28' },
  nowKicker: { color: '#8b5cf6', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  nowTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 4 },
  channel: { color: '#777481', fontSize: 12, marginTop: 3 },
  live: { color: '#bca8ed', fontSize: 10, fontWeight: '900' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 10 },
  control: { alignItems: 'center', padding: 8 },
  controlText: { color: '#d8d1e2', fontSize: 28 },
  controlSub: { color: '#777481', fontSize: 9 },
  play: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
  playText: { color: '#fff', fontSize: 23, fontWeight: '900' },
  controlDisabled: { opacity: 0.45 },
  disabled: { opacity: 0.5 },
  viewerHint: { alignItems: 'center', paddingVertical: 8 },
  viewerHintText: { color: '#777481', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  joinCard: { backgroundColor: '#111019', borderRadius: 18, padding: 15, marginTop: 8 },
  joinTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  nameInput: { backgroundColor: '#0b0a10', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10, borderWidth: 1, borderColor: '#292531' },
  joinBtn: { backgroundColor: '#24173f', padding: 12, borderRadius: 12, marginTop: 10, alignItems: 'center' },
  joinBtnText: { color: '#cfc2ed', fontWeight: '800' },
  syncBtn: { backgroundColor: '#8b5cf6', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  syncBtnText: { color: '#fff', fontWeight: '900' },
  queueHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 7 },
  queueActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  section: { color: '#777481', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  add: { color: '#c4b5fd', fontWeight: '900' },
  chatToggle: { color: '#a78bfa', fontWeight: '800' },
  queue: { gap: 8, paddingBottom: 28 },
  queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111019', borderRadius: 14, padding: 7 },
  currentQueueItem: { borderWidth: 1, borderColor: '#6d4ab6' },
  queueMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  qThumb: { width: 70, height: 44, borderRadius: 8, backgroundColor: '#201d27', marginRight: 10 },
  qTitle: { color: '#eee', fontWeight: '700', fontSize: 13 },
  qMeta: { color: '#686570', fontSize: 11, marginTop: 3 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemAction: { color: '#a78bfa', fontSize: 18, padding: 5 },
  itemRemove: { color: '#e28d9b', fontSize: 22, padding: 4 },
  empty: { color: '#67636f', textAlign: 'center', padding: 18 },
  muted: { color: '#777481', marginTop: 6, textAlign: 'center' },
  primaryBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, marginTop: 18 },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  chat: { backgroundColor: '#111019', borderRadius: 16, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#201d28', overflow: 'hidden' },
  chatKeyboard: { flex: 1 },
  chatBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  chatSheet: { backgroundColor: '#111019', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '78%', borderWidth: 1, borderColor: '#292531' },
  messageList: { paddingBottom: 8 },
  chatHeader: { marginBottom: 6 },
  messages: { maxHeight: 340 },
  message: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1d1a24' },
  messageName: { color: '#a78bfa', fontSize: 10, fontWeight: '900' },
  messageText: { color: '#e7e3ed', fontSize: 13, marginTop: 2, lineHeight: 18 },
  messageRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  messageInput: { flex: 1, backgroundColor: '#0b0a10', color: '#fff', borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  sendBtn: { backgroundColor: '#8b5cf6', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 14 },
  sendText: { color: '#fff', fontWeight: '900' },
  leaveBtn: { borderWidth: 1, borderColor: '#3a2730', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10 },
  leaveText: { color: '#c99ca5', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' },
  accessSheet: { backgroundColor: '#111019', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '72%', borderWidth: 1, borderColor: '#292531' },
  accessHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  accessTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  accessSub: { color: '#777481', fontSize: 12, marginTop: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#201d27', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 24, lineHeight: 26 },
  accessList: { maxHeight: 330 },
  accessRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#201d28' },
  accessName: { color: '#eee', fontSize: 14, fontWeight: '800' },
  accessRole: { color: '#777481', fontSize: 11, marginTop: 3 },
  accessToggle: { backgroundColor: '#201d27', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  accessToggleOn: { backgroundColor: '#38235f' },
  accessToggleText: { color: '#c4b5fd', fontSize: 9, fontWeight: '900' },
  shareRoomBtn: { backgroundColor: '#8b5cf6', borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 12 },
  shareRoomText: { color: '#fff', fontWeight: '900' },
});

