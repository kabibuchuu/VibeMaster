import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { auth } from '../firebase';
import { joinRoom, updatePlayback, watchParticipants, watchRoom } from '../src/lib/roomRepository';
import type { Participant, Room } from '../src/types/room';

type PlayerMessage =
  | { type: 'ready' }
  | { type: 'state'; state: number; position: number };

const DRIFT_TOLERANCE_SECONDS = 0.75;

export default function RoomScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const roomCode = String(code).toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [name, setName] = useState('Guest');
  const [video, setVideo] = useState('');
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<WebView>(null);

  const isHost = room?.hostId === auth.currentUser?.uid;

  useEffect(() => watchRoom(roomCode, setRoom), [roomCode]);
  useEffect(() => watchParticipants(roomCode, setPeople), [roomCode]);

  async function join() {
    if (auth.currentUser) {
      await joinRoom(roomCode, auth.currentUser.uid, name.trim() || 'Guest');
    }
  }

  function sendPlayerCommand(command: string) {
    playerRef.current?.injectJavaScript(
      `if(window.vmPlayer){window.vmPlayer.${command}} true;`,
    );
  }

  async function publishPlayerState(status: 'playing' | 'paused', position: number) {
    await updatePlayback(roomCode, {
      status,
      position: Math.max(0, position),
    });
  }

  function handlePlayerMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as PlayerMessage;

      if (message.type === 'ready') {
        setPlayerReady(true);
        return;
      }

      if (!isHost || message.type !== 'state') return;

      if (message.state === 1) {
        void publishPlayerState('playing', message.position);
      } else if (message.state === 2) {
        void publishPlayerState('paused', message.position);
      }
    } catch {
      // Ignore malformed WebView messages.
    }
  }

  useEffect(() => {
    if (!room || !playerReady || isHost || !room.videoId) return;

    const sync = () => {
      const elapsed = room.status === 'playing'
        ? (Date.now() - room.updatedAt) / 1000
        : 0;
      const target = Math.max(0, room.position + elapsed);
      const status = room.status;

      playerRef.current?.injectJavaScript(
        `if(window.vmPlayer){
          const current=window.vmPlayer.getCurrentTime();
          const target=${target};
          if(Math.abs(current-target)>${DRIFT_TOLERANCE_SECONDS}) window.vmPlayer.seekTo(target,true);
          if('${status}'==='playing') window.vmPlayer.playVideo();
          else window.vmPlayer.pauseVideo();
        } true;`,
      );
    };

    sync();
    const timer = setInterval(sync, 1500);
    return () => clearInterval(timer);
  }, [room, playerReady, isHost]);

  const html = useMemo(() => {
    if (!room?.videoId) {
      return '<html><body style="background:#111;color:white;text-align:center;padding-top:30%;font-family:sans-serif">Add a YouTube video as host</body></html>';
    }

    return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style>
</head>
<body>
<div id="player"></div>
<script>
var vmPlayer;
function send(message){
  if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
}
function onYouTubeIframeAPIReady(){
  vmPlayer = new YT.Player('player',{
    videoId:'${room.videoId}',
    playerVars:{playsinline:1,controls:0,rel:0,modestbranding:1},
    events:{
      onReady:function(){send({type:'ready'});},
      onStateChange:function(e){
        if(!vmPlayer) return;
        send({type:'state',state:e.data,position:vmPlayer.getCurrentTime()||0});
      }
    }
  });
}
</script>
<script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`;
  }, [room?.videoId]);

  if (!room) {
    return (
      <SafeAreaView style={s.c}>
        <Text style={s.t}>Room {roomCode}</Text>
        <Text style={s.m}>Room not found.</Text>
      </SafeAreaView>
    );
  }

  const currentStatus = room.status === 'playing' ? 'Playing' : 'Paused';

  return (
    <SafeAreaView style={s.c}>
      <View style={s.head}>
        <View>
          <Text style={s.t}>{roomCode}</Text>
          <Text style={s.m}>{people.length} listener{people.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={s.status}>
          <Text style={s.statusText}>{currentStatus}</Text>
        </View>
      </View>

      <View style={s.player}>
        <WebView
          ref={playerRef}
          source={{ html }}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onMessage={handlePlayerMessage}
        />
      </View>

      {!isHost && (
        <View style={s.card}>
          <Text style={s.m}>Choose your display name</Text>
          <TextInput value={name} onChangeText={setName} style={s.input} />
          <TouchableOpacity style={s.btn} onPress={join}>
            <Text style={s.bt}>Join Room</Text>
          </TouchableOpacity>
        </View>
      )}

      {isHost && (
        <View style={s.card}>
          <Text style={s.t}>Host controls</Text>
          <TextInput
            value={video}
            onChangeText={setVideo}
            placeholder="YouTube video ID"
            placeholderTextColor="#777"
            style={s.input}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={s.btn}
            onPress={() => {
              const id = video.trim();
              if (!id) return;
              updatePlayback(roomCode, {
                videoId: id,
                status: 'paused',
                position: 0,
              });
              setPlayerReady(false);
            }}
          >
            <Text style={s.bt}>Load Video</Text>
          </TouchableOpacity>

          <View style={s.row}>
            <TouchableOpacity
              style={s.smallBtn}
              disabled={!playerReady}
              onPress={() => sendPlayerCommand('playVideo();')}
            >
              <Text style={s.bt}>▶ Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.smallBtn}
              disabled={!playerReady}
              onPress={() => sendPlayerCommand('pauseVideo();')}
            >
              <Text style={s.bt}>⏸ Pause</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.smallBtn}
              disabled={!playerReady}
              onPress={() => sendPlayerCommand('seekTo(Math.max(0,window.vmPlayer.getCurrentTime()-10),true);')}
            >
              <Text style={s.bt}>↶ 10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.smallBtn}
              disabled={!playerReady}
              onPress={() => sendPlayerCommand('seekTo(window.vmPlayer.getCurrentTime()+10,true);')}
            >
              <Text style={s.bt}>10s ↷</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.hint}>
            Play, pause and seek changes are synced to everyone in the room.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0b0712', padding: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  t: { color: '#fff', fontSize: 20, fontWeight: '800' },
  m: { color: '#999' },
  status: { backgroundColor: '#24183a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { color: '#c4b5fd', fontWeight: '700', fontSize: 12 },
  player: { height: 230, backgroundColor: '#000', borderRadius: 14, overflow: 'hidden' },
  card: { backgroundColor: '#17111f', padding: 16, borderRadius: 14, marginTop: 14 },
  input: { backgroundColor: '#0e0a14', color: '#fff', padding: 13, borderRadius: 10, marginTop: 10 },
  btn: { backgroundColor: '#7c3aed', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallBtn: { backgroundColor: '#4c1d95', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  bt: { color: '#fff', fontWeight: '700' },
  hint: { color: '#777', fontSize: 12, marginTop: 10, lineHeight: 17 },
});