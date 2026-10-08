import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../firebase';
import { createRoom, setQueue, updateRoom } from '../src/lib/roomRepository';
import { getPlaylistItems } from '../src/lib/youtube';
import type { QueueItem, RoomMode } from '../src/types/room';

const makeCode=()=>Math.random().toString(36).slice(2,8).toUpperCase();

export default function Create(){
  const params=useLocalSearchParams<{videoId?:string;playlistId?:string;title?:string;channel?:string;thumbnail?:string;kind?:'music'|'video'|'playlist';duration?:string}>();
  const [code,setCode]=useState(''); const [mode,setMode]=useState<RoomMode>(params.kind==='music'?'music':params.kind==='video'?'video':'mixed'); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(()=>setCode(makeCode()),[]);

  async function create(){
    if(!auth.currentUser||!code)return;
    setBusy(true);setError('');
    try{
      let queue:QueueItem[]=[];
      if(params.playlistId) queue=(await getPlaylistItems(String(params.playlistId))).slice(0,50);
      else if(params.videoId) queue=[{id:String(params.videoId),videoId:String(params.videoId),title:String(params.title??'Selected video'),channelTitle:String(params.channel??'YouTube'),thumbnail:String(params.thumbnail??''),duration:params.duration?String(params.duration):undefined,kind:params.kind==='music'?'music':'video'}];

      let createdCode='';
      for(let attempt=0;attempt<8&&!createdCode;attempt++){
        const candidate=attempt===0?code:makeCode();
        try{await createRoom(candidate,auth.currentUser.uid,mode);createdCode=candidate;setCode(candidate);}
        catch(e){if(e instanceof Error&&e.message!=='ROOM_EXISTS')throw e;if(attempt===7)throw new Error('Could not reserve a room code. Try again.');}
      }
      if(queue.length){await setQueue(createdCode,queue);await updateRoom(createdCode,{currentItemId:queue[0].id});}
      router.replace({pathname:'/room',params:{code:createdCode}});
    }catch(e){setError(e instanceof Error?e.message:'Could not create the room.');}
    finally{setBusy(false);}
  }

  return <SafeAreaView style={s.c} edges={['top','bottom']}><View style={s.top}><Text style={s.kicker}>CREATE A VIBE</Text><Text style={s.title}>{params.title?'Make this the first vibe.':'What are we doing tonight?'}</Text><Text style={s.sub}>{params.title?params.title:'Choose the room experience. Build the queue once everyone arrives.'}</Text></View><View style={s.options}>{([['music','🎵','Music Night','Songs, albums and playlists'],['video','🎬','Watch Party','Videos and playlists'],['mixed','✨','Mixed Vibe','Anything goes']] as const).map(([value,icon,title,desc])=><TouchableOpacity key={value} style={[s.option,mode===value&&s.selected]} onPress={()=>setMode(value)}><Text style={s.icon}>{icon}</Text><View style={{flex:1}}><Text style={s.optionTitle}>{title}</Text><Text style={s.desc}>{desc}</Text></View><Text style={s.radio}>{mode===value?'●':'○'}</Text></TouchableOpacity>)}</View>{error?<View style={s.error}><Text style={s.errorText}>{error}</Text></View>:null}<TouchableOpacity style={[s.btn,busy&&s.btnDisabled]} onPress={create} disabled={busy}>{busy?<ActivityIndicator color="#fff"/>:<Text style={s.btnText}>Create Room</Text>}</TouchableOpacity><Text style={s.code}>ROOM {code}</Text></SafeAreaView>;
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#08070d',padding:22},top:{marginTop:36,marginBottom:24},kicker:{color:'#a78bfa',fontSize:12,fontWeight:'800',letterSpacing:2},title:{color:'#fff',fontSize:32,fontWeight:'900',marginTop:8},sub:{color:'#898794',fontSize:15,lineHeight:22,marginTop:10},options:{gap:12},option:{flexDirection:'row',alignItems:'center',backgroundColor:'#111019',borderWidth:1,borderColor:'#24212d',padding:18,borderRadius:20},selected:{borderColor:'#8b5cf6',backgroundColor:'#171128'},icon:{fontSize:28,marginRight:14},optionTitle:{color:'#fff',fontSize:17,fontWeight:'800'},desc:{color:'#888593',marginTop:4},radio:{color:'#a78bfa',fontSize:20},error:{backgroundColor:'#35151c',padding:12,borderRadius:14,marginTop:12},errorText:{color:'#f0b7c1',lineHeight:18},btn:{backgroundColor:'#8b5cf6',padding:17,borderRadius:18,alignItems:'center',justifyContent:'center',marginTop:'auto',minHeight:56},btnDisabled:{opacity:.6},btnText:{color:'#fff',fontSize:16,fontWeight:'800'},code:{color:'#555260',textAlign:'center',marginTop:14,letterSpacing:3,fontSize:11}});