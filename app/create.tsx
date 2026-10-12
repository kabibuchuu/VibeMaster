import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      else if(params.videoId){
        const item:QueueItem = {
          id:String(params.videoId),
          videoId:String(params.videoId),
          title:String(params.title??'Selected video'),
          channelTitle:String(params.channel??'YouTube'),
          thumbnail:String(params.thumbnail??''),
          kind:params.kind==='music'?'music':'video',
        };
        if(params.duration) item.duration=String(params.duration);
        queue=[item];
      }

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

  return <SafeAreaView style={s.c} edges={['top','bottom']}>
    <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={s.backRow} onPress={() => router.back()}><Text style={s.back}>‹</Text><Text style={s.backLabel}>BACK TO DISCOVER</Text></TouchableOpacity>
      <View style={s.top}>
        <View style={s.eyebrow}><View style={s.eyebrowDot}/><Text style={s.kicker}>YOUR SPACE, YOUR RULES</Text></View>
        <Text style={s.title}>{params.title?'Make this the first vibe.':'Bring everyone into one room.'}</Text>
        <Text style={s.sub}>{params.title ? 'Start with your pick, then let the room keep the good stuff going.' : 'Pick the mood. Invite your people. Let the queue take it from here.'}</Text>
        {params.title ? <View style={s.selectedMedia}><View style={s.mediaMark}><Text style={s.mediaMarkText}>{params.kind==='music'?'♫':'▷'}</Text></View><View style={{flex:1}}><Text style={s.selectedLabel}>STARTING WITH</Text><Text numberOfLines={2} style={s.selectedTitle}>{params.title}</Text><Text numberOfLines={1} style={s.selectedChannel}>{params.channel||'YouTube'}</Text></View></View> : null}
      </View>
      <View style={s.sectionHead}><Text style={s.sectionTitle}>Choose your vibe</Text><Text style={s.sectionHint}>01 / 03</Text></View>
      <View style={s.options}>{([['music','♫','Music Night','Songs, albums and playlists','AUDIO'],['video','▷','Watch Party','Videos worth watching together','VIDEO'],['mixed','✦','Mixed Vibe','Switch between anything','ALL ACCESS']] as const).map(([value,icon,title,desc,tag])=><TouchableOpacity key={value} style={[s.option,mode===value&&s.selected]} onPress={()=>setMode(value)} activeOpacity={0.82}><View style={[s.iconWrap,mode===value&&s.iconWrapSelected]}><Text style={[s.icon,mode===value&&s.iconSelected]}>{icon}</Text></View><View style={{flex:1}}><View style={s.optionHeading}><Text style={s.optionTitle}>{title}</Text>{mode===value?<View style={s.chosenPill}><Text style={s.chosenText}>SELECTED</Text></View>:null}</View><Text style={s.desc}>{desc}</Text><Text style={s.optionTag}>{tag}</Text></View><View style={[s.radio,mode===value&&s.radioOn]}>{mode===value?<Text style={s.radioTick}>✓</Text>:null}</View></TouchableOpacity>)}</View>
      <View style={s.roomPreview}><View><Text style={s.previewLabel}>YOUR ROOM CODE</Text><Text style={s.code}>{code||'GENERATING…'}</Text></View><View style={s.previewBadge}><Text style={s.previewBadgeText}>PRIVATE VIBE</Text></View></View>
      {error?<View style={s.error}><Text style={s.errorTitle}>Couldn’t create your room</Text><Text style={s.errorText}>{error}</Text></View>:null}
      <TouchableOpacity style={[s.btn,busy&&s.btnDisabled]} onPress={create} disabled={busy} activeOpacity={0.85}>{busy?<ActivityIndicator color="#fff"/>:<><Text style={s.btnText}>Create your room</Text><Text style={s.btnArrow}>↗</Text></>}</TouchableOpacity>
      <Text style={s.footnote}>You can add more songs and videos once everyone joins.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 c:{flex:1,backgroundColor:'#08070d'},page:{paddingHorizontal:22,paddingTop:10,paddingBottom:28},
 backRow:{flexDirection:'row',alignItems:'center',marginBottom:16},back:{color:'#d6c8f5',fontSize:30,lineHeight:32,marginRight:8},backLabel:{color:'#766b8a',fontSize:9,fontWeight:'900',letterSpacing:1.8},
 top:{backgroundColor:'#141020',padding:22,borderRadius:27,borderWidth:1,borderColor:'#352648',overflow:'hidden'},
 eyebrow:{flexDirection:'row',alignItems:'center',gap:8},eyebrowDot:{width:6,height:6,borderRadius:3,backgroundColor:'#b69aff'},kicker:{color:'#bda4f8',fontSize:9,fontWeight:'900',letterSpacing:2},
 title:{color:'#fff',fontSize:31,fontWeight:'900',marginTop:17,letterSpacing:-.8,lineHeight:36},sub:{color:'#a49aad',fontSize:13,lineHeight:20,marginTop:10},
 selectedMedia:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#0b0911',borderWidth:1,borderColor:'#30263e',borderRadius:16,padding:12,marginTop:18},mediaMark:{width:42,height:42,borderRadius:13,backgroundColor:'#2a1c41',alignItems:'center',justifyContent:'center'},mediaMarkText:{color:'#d9c7ff',fontSize:24,fontWeight:'900'},selectedLabel:{color:'#8e7ba8',fontSize:8,fontWeight:'900',letterSpacing:1.5},selectedTitle:{color:'#f7f1ff',fontSize:13,fontWeight:'800',marginTop:4},selectedChannel:{color:'#81788c',fontSize:10,marginTop:3},
 sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:24,marginBottom:12},sectionTitle:{color:'#f4efff',fontSize:18,fontWeight:'900',letterSpacing:-.3},sectionHint:{color:'#645873',fontSize:9,fontWeight:'900',letterSpacing:1.2},
 options:{gap:10},option:{flexDirection:'row',alignItems:'center',backgroundColor:'#121019',borderWidth:1,borderColor:'#292434',padding:14,borderRadius:19,minHeight:92},selected:{borderColor:'#9870db',backgroundColor:'#20162f'},iconWrap:{width:48,height:48,borderRadius:15,backgroundColor:'#211a2d',alignItems:'center',justifyContent:'center',marginRight:13},iconWrapSelected:{backgroundColor:'#392456'},icon:{fontSize:26,color:'#aaa0b9',fontWeight:'900'},iconSelected:{color:'#e1d1ff'},optionHeading:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8},optionTitle:{color:'#fff',fontSize:15,fontWeight:'900'},chosenPill:{backgroundColor:'#392456',paddingHorizontal:7,paddingVertical:3,borderRadius:999},chosenText:{color:'#d7c1ff',fontSize:7,fontWeight:'900',letterSpacing:1},desc:{color:'#9991a5',fontSize:11,marginTop:5,lineHeight:15},optionTag:{color:'#645a75',fontSize:7,fontWeight:'900',letterSpacing:1.4,marginTop:7},radio:{width:21,height:21,borderRadius:11,borderWidth:1.5,borderColor:'#4b4258',marginLeft:9,alignItems:'center',justifyContent:'center'},radioOn:{backgroundColor:'#9b72e5',borderColor:'#9b72e5'},radioTick:{color:'#fff',fontSize:12,fontWeight:'900'},
 roomPreview:{marginTop:18,padding:16,backgroundColor:'#100e17',borderWidth:1,borderColor:'#292334',borderRadius:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},previewLabel:{color:'#80768f',fontSize:8,fontWeight:'900',letterSpacing:1.6},code:{color:'#d6c3ff',fontSize:22,fontWeight:'900',letterSpacing:4,marginTop:6},previewBadge:{backgroundColor:'#1b1725',borderRadius:9,paddingHorizontal:9,paddingVertical:7},previewBadgeText:{color:'#9b8aaa',fontSize:7,fontWeight:'900',letterSpacing:1},
 error:{backgroundColor:'#35151c',padding:13,borderRadius:14,marginTop:12,borderWidth:1,borderColor:'#6c2936'},errorTitle:{color:'#fff',fontWeight:'900',fontSize:12},errorText:{color:'#f0b7c1',lineHeight:18,marginTop:5,fontSize:12},
 btn:{backgroundColor:'#8b5cf6',paddingHorizontal:18,paddingVertical:17,borderRadius:17,alignItems:'center',justifyContent:'space-between',flexDirection:'row',marginTop:18,minHeight:58,shadowColor:'#8b5cf6',shadowOpacity:.2,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:4},btnDisabled:{opacity:.6},btnText:{color:'#fff',fontSize:14,fontWeight:'900'},btnArrow:{color:'#fff',fontSize:19,fontWeight:'900'},footnote:{color:'#5f586b',textAlign:'center',marginTop:12,fontSize:10,lineHeight:15}
});