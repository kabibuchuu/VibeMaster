import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { auth } from '../firebase';
import { addQueueItem, joinRoom, setQueue, updateRoom, updatePlayback, watchParticipants, watchRoom } from '../src/lib/roomRepository';
import { getPlaylistItems } from '../src/lib/youtube';
import type { Participant, QueueItem, Room } from '../src/types/room';

type PlayerMessage =
  | { type: 'ready' }
  | { type: 'state'; state: number; position: number }
  | { type: 'seek'; position: number }
  | { type: 'error'; code: number };
const DRIFT_TOLERANCE_SECONDS=0.75;

export default function RoomScreen(){
  const {code,videoId,playlistId,title,channel,thumbnail,kind,duration}=useLocalSearchParams<{code:string,videoId?:string,playlistId?:string,title?:string,channel?:string,thumbnail?:string,kind?:'music'|'video',duration?:string}>();
  const roomCode=String(code).toUpperCase(); const[room,setRoom]=useState<Room|null>(null); const[people,setPeople]=useState<Participant[]>([]); const[name,setName]=useState('Guest'); const[playerReady,setPlayerReady]=useState(false); const[playerError,setPlayerError]=useState<number|null>(null); const playerRef=useRef<WebView>(null); const addedRef=useRef('');
  const isHost=room?.hostId===auth.currentUser?.uid; const current=room?.queue?.find(x=>x.id===room.currentItemId)??room?.queue?.[0];

  useEffect(()=>watchRoom(roomCode,setRoom),[roomCode]);
  useEffect(()=>watchParticipants(roomCode,setPeople),[roomCode]);
  useEffect(()=>{
    if(!room||!isHost)return;
    if(playlistId&&addedRef.current!==String(playlistId)){addedRef.current=String(playlistId);void getPlaylistItems(String(playlistId)).then(items=>{if(!items.length)return;void setQueue(roomCode,[...(room.queue??[]),...items]);if(!room.currentItemId)void updateRoom(roomCode,{currentItemId:items[0].id});}).catch(()=>{});return;}
    if(videoId&&addedRef.current!==String(videoId)){addedRef.current=String(videoId);const item:QueueItem={id:String(videoId),videoId:String(videoId),title:String(title??'Selected video'),channelTitle:String(channel??'YouTube'),thumbnail:String(thumbnail??''),duration:String(duration??''),kind:kind==='music'?'music':'video'};void addQueueItem(roomCode,item).then(()=>updateRoom(roomCode,{currentItemId:room.currentItemId||item.id}));}
  },[room,isHost,videoId,playlistId,title,channel,thumbnail,kind,duration,roomCode]);

  async function join(){if(auth.currentUser)await joinRoom(roomCode,auth.currentUser.uid,name.trim()||'Guest');}
  function send(command:string){playerRef.current?.injectJavaScript(`if(window.vmPlayer){window.vmPlayer.${command}} true;`);}
  function seek(delta:number){playerRef.current?.injectJavaScript(`if(window.vmPlayer){const target=Math.max(0,window.vmPlayer.getCurrentTime()+${delta});window.vmPlayer.seekTo(target,true);window.ReactNativeWebView.postMessage(JSON.stringify({type:'seek',position:target}));} true;`);}
  async function publish(status:'playing'|'paused',position:number){if(current)await updatePlayback(roomCode,{status,position,currentItemId:current.id});}
  function onMessage(event:WebViewMessageEvent){try{const m=JSON.parse(event.nativeEvent.data) as PlayerMessage;if(m.type==='ready'){setPlayerReady(true);setPlayerError(null);return;}if(m.type==='error'){setPlayerError(m.code);return;}if(!isHost)return;if(m.type==='seek'){void publish(room?.status==='playing'?'playing':'paused',m.position);}else if(m.type==='state'){if(m.state===1)void publish('playing',m.position);else if(m.state===2)void publish('paused',m.position);}}catch{}}

  useEffect(()=>{
    if(!room||!current||!playerReady||isHost)return;
    const sync=()=>{const elapsed=room.status==='playing'?(Date.now()-room.updatedAt)/1000:0;const target=Math.max(0,room.position+elapsed);const status=room.status;playerRef.current?.injectJavaScript(`if(window.vmPlayer){const current=window.vmPlayer.getCurrentTime();const target=${target};if(Math.abs(current-target)>${DRIFT_TOLERANCE_SECONDS})window.vmPlayer.seekTo(target,true);if('${status}'==='playing')window.vmPlayer.playVideo();else window.vmPlayer.pauseVideo();} true;`);};
    sync();const timer=setInterval(sync,1500);return()=>clearInterval(timer);
  },[room,playerReady,isHost,current?.id]);

  const html=useMemo(()=>{
    if(!current)return '<html><body style="background:#08070d;color:#aaa;text-align:center;padding-top:35%;font-family:sans-serif">Search something to start the vibe.</body></html>';
    const safeId=current.videoId.replace(/'/g,'');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><div id="player"></div><script>var vmPlayer;function send(m){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(m));}function onYouTubeIframeAPIReady(){vmPlayer=new YT.Player('player',{videoId:'${safeId}',playerVars:{playsinline:1,controls:1,rel:0,modestbranding:1,iv_load_policy:3},events:{onReady:function(){send({type:'ready'});},onError:function(e){send({type:'error',code:e.data});},onStateChange:function(e){if(vmPlayer)send({type:'state',state:e.data,position:vmPlayer.getCurrentTime()||0});}}});}</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`;
  },[current?.id]);

  if(!room)return <SafeAreaView style={s.center}><Text style={s.big}>Room {roomCode}</Text><Text style={s.muted}>Waiting for the room…</Text></SafeAreaView>;
  const status=room.status==='playing'?'LIVE':'PAUSED';
  return <SafeAreaView style={s.c}>
    <View style={s.header}><View><Text style={s.kicker}>{room.mode.toUpperCase()} ROOM</Text><Text style={s.title}>{roomCode}</Text></View><View style={s.people}><Text style={s.peopleText}>● {people.length}</Text></View></View>
    <View style={s.player}><WebView ref={playerRef} source={{html}} javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} onMessage={onMessage}/></View>
    {playerError?<View style={s.error}><Text style={s.errorTitle}>This video cannot play here</Text><Text style={s.errorText}>YouTube rejected this embed (error {playerError}). Pick another result from Search.</Text></View>:null}
    <View style={s.now}><View style={{flex:1}}>{current?<><Text style={s.nowKicker}>NOW PLAYING</Text><Text numberOfLines={2} style={s.nowTitle}>{current.title}</Text><Text style={s.channel}>{current.channelTitle}</Text></>:<Text style={s.muted}>Nothing queued yet</Text>}</View><Text style={s.live}>{status}</Text></View>
    {isHost&&<View style={s.controls}><TouchableOpacity style={s.control} onPress={()=>seek(-10)} disabled={!playerReady}><Text style={s.controlText}>↶</Text><Text style={s.controlSub}>10s</Text></TouchableOpacity><TouchableOpacity style={s.play} onPress={()=>send(room.status==='playing'?'pauseVideo();':'playVideo();')} disabled={!playerReady}><Text style={s.playText}>{room.status==='playing'?'Ⅱ':'▶'}</Text></TouchableOpacity><TouchableOpacity style={s.control} onPress={()=>seek(10)} disabled={!playerReady}><Text style={s.controlText}>↷</Text><Text style={s.controlSub}>10s</Text></TouchableOpacity></View>}
    {!isHost&&<View style={s.joinCard}><Text style={s.joinTitle}>You're listening in</Text><Text style={s.muted}>Host controls playback so everyone stays together.</Text><TouchableOpacity style={s.joinBtn} onPress={join}><Text style={s.joinBtnText}>Join as {name}</Text></TouchableOpacity></View>}
    <View style={s.queueHead}><Text style={s.section}>UP NEXT · {room.queue.length}</Text>{isHost&&<TouchableOpacity onPress={()=>router.push({pathname:'/search',params:{kind:room.mode==='music'?'music':'all',roomCode}})}><Text style={s.add}>＋ Add</Text></TouchableOpacity>}</View>
    <ScrollView contentContainerStyle={s.queue}>{room.queue.filter(x=>x.id!==current?.id).map((item,i)=><TouchableOpacity key={item.id} style={s.queueItem} onPress={()=>isHost&&updateRoom(roomCode,{currentItemId:item.id,status:'paused',position:0})}><Image source={{uri:item.thumbnail}} style={s.qThumb}/><View style={{flex:1}}><Text numberOfLines={1} style={s.qTitle}>{i+1}. {item.title}</Text><Text style={s.qMeta}>{item.channelTitle}{item.duration?' · '+item.duration:''}</Text></View></TouchableOpacity>)}{!room.queue.length&&<Text style={s.empty}>Add a song or video to build the queue.</Text>}</ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#08070d',padding:16},center:{flex:1,backgroundColor:'#08070d',alignItems:'center',justifyContent:'center'},big:{color:'#fff',fontSize:26,fontWeight:'900'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},kicker:{color:'#a78bfa',fontSize:10,fontWeight:'900',letterSpacing:2},title:{color:'#fff',fontSize:22,fontWeight:'900',marginTop:3},people:{backgroundColor:'#15131d',paddingHorizontal:12,paddingVertical:8,borderRadius:999},peopleText:{color:'#c4b5fd',fontWeight:'800'},player:{height:220,borderRadius:18,overflow:'hidden',backgroundColor:'#000'},error:{backgroundColor:'#35151c',borderRadius:14,padding:12,marginTop:10},errorTitle:{color:'#fff',fontWeight:'800'},errorText:{color:'#c99ca5',fontSize:12,lineHeight:18,marginTop:3},now:{flexDirection:'row',backgroundColor:'#111019',borderRadius:18,padding:16,marginTop:12,borderWidth:1,borderColor:'#201d28'},nowKicker:{color:'#8b5cf6',fontSize:9,fontWeight:'900',letterSpacing:1.5},nowTitle:{color:'#fff',fontSize:16,fontWeight:'900',marginTop:4},channel:{color:'#777481',fontSize:12,marginTop:3},live:{color:'#bca8ed',fontSize:10,fontWeight:'900'},controls:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:24,paddingVertical:12},control:{alignItems:'center',padding:8},controlText:{color:'#d8d1e2',fontSize:28},controlSub:{color:'#777481',fontSize:9},play:{width:58,height:58,borderRadius:29,backgroundColor:'#8b5cf6',alignItems:'center',justifyContent:'center'},playText:{color:'#fff',fontSize:23,fontWeight:'900'},joinCard:{backgroundColor:'#111019',borderRadius:18,padding:15,marginTop:8},joinTitle:{color:'#fff',fontWeight:'800',fontSize:16},joinBtn:{backgroundColor:'#24173f',padding:12,borderRadius:12,marginTop:10,alignItems:'center'},joinBtnText:{color:'#cfc2ed',fontWeight:'800'},queueHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:10,marginBottom:7},section:{color:'#777481',fontSize:11,fontWeight:'900',letterSpacing:1.4},add:{color:'#c4b5fd',fontWeight:'900'},queue:{gap:8,paddingBottom:24},queueItem:{flexDirection:'row',alignItems:'center',backgroundColor:'#111019',borderRadius:14,padding:7},qThumb:{width:70,height:44,borderRadius:8,backgroundColor:'#201d27',marginRight:10},qTitle:{color:'#eee',fontWeight:'700',fontSize:13},qMeta:{color:'#686570',fontSize:11,marginTop:3},empty:{color:'#67636f',textAlign:'center',padding:18},muted:{color:'#777481',marginTop:6}});
