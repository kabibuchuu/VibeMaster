import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth } from '../firebase';
import { createRoom, setQueue, updateRoom } from '../src/lib/roomRepository';
import type { QueueItem, RoomMode } from '../src/types/room';
const makeCode=()=>Math.random().toString(36).slice(2,8).toUpperCase();

export default function Create(){
  const params=useLocalSearchParams<{videoId?:string,title?:string,channel?:string,thumbnail?:string,kind?:'music'|'video',duration?:string}>();
  const [code,setCode]=useState(''); const[mode,setMode]=useState<RoomMode>(params.kind==='music'?'music':params.kind==='video'?'video':'mixed'); const[busy,setBusy]=useState(false);
  useEffect(()=>setCode(makeCode()),[]);
  async function create(){
    if(!auth.currentUser)return; setBusy(true);
    try{
      await createRoom(code,auth.currentUser.uid,mode);
      if(params.videoId){
        const item:QueueItem={id:params.videoId,videoId:params.videoId,title:params.title??'Selected video',channelTitle:params.channel??'YouTube',thumbnail:params.thumbnail??'',duration:params.duration,kind:params.kind??'video'};
        await setQueue(code,[item]);
        await updateRoom(code,{currentItemId:item.id});
      }
      router.replace({pathname:'/room',params:{code}});
    } finally {setBusy(false);}
  }
  return <SafeAreaView style={s.c}><View style={s.top}><Text style={s.kicker}>CREATE A VIBE</Text><Text style={s.title}>{params.title?'Make this the first vibe.':'What are we doing tonight?'}</Text><Text style={s.sub}>{params.title?params.title:'Choose the room experience. Build the queue once everyone arrives.'}</Text></View><View style={s.options}>{([['music','🎵','Music Night','Songs, albums and playlists'],['video','🎬','Watch Party','Videos and playlists'],['mixed','✨','Mixed Vibe','Anything goes']] as const).map(([value,icon,title,desc])=><TouchableOpacity key={value} style={[s.option,mode===value&&s.selected]} onPress={()=>setMode(value)}><Text style={s.icon}>{icon}</Text><View style={{flex:1}}><Text style={s.optionTitle}>{title}</Text><Text style={s.desc}>{desc}</Text></View><Text style={s.radio}>{mode===value?'●':'○'}</Text></TouchableOpacity>)}</View><TouchableOpacity style={s.btn} onPress={create} disabled={busy}><Text style={s.btnText}>{busy?'Creating…':'Create Room'}</Text></TouchableOpacity><Text style={s.code}>ROOM {code}</Text></SafeAreaView>
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#08070d',padding:22},top:{marginTop:36,marginBottom:24},kicker:{color:'#a78bfa',fontSize:12,fontWeight:'800',letterSpacing:2},title:{color:'#fff',fontSize:32,fontWeight:'900',marginTop:8},sub:{color:'#898794',fontSize:15,lineHeight:22,marginTop:10},options:{gap:12},option:{flexDirection:'row',alignItems:'center',backgroundColor:'#111019',borderWidth:1,borderColor:'#24212d',padding:18,borderRadius:20},selected:{borderColor:'#8b5cf6',backgroundColor:'#171128'},icon:{fontSize:28,marginRight:14},optionTitle:{color:'#fff',fontSize:17,fontWeight:'800'},desc:{color:'#888593',marginTop:4},radio:{color:'#a78bfa',fontSize:20},btn:{backgroundColor:'#8b5cf6',padding:17,borderRadius:18,alignItems:'center',marginTop:'auto'},btnText:{color:'#fff',fontSize:16,fontWeight:'800'},code:{color:'#555260',textAlign:'center',marginTop:14,letterSpacing:3,fontSize:11}});
