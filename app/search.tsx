import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { getPlaylistItems, searchYouTube, youtubeConfigured, type YouTubeResult } from '../src/lib/youtube';
import { addQueueItem, appendQueueItems } from '../src/lib/roomRepository';
import type { QueueItem } from '../src/types/room';

export default function Search(){
  const params=useLocalSearchParams<{kind?:'music'|'video'|'all';roomCode?:string}>();
  const [query,setQuery]=useState('');const [kind,setKind]=useState<'music'|'video'|'all'>(params.kind??'all');const [results,setResults]=useState<YouTubeResult[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{if(!youtubeConfigured())setError('Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local and restart Expo.');},[]);
  async function search(){if(!query.trim())return;setLoading(true);setError('');try{setResults(await searchYouTube(query.trim(),kind));}catch(e){setError(e instanceof Error?e.message:'Search failed.');}finally{setLoading(false);}}
  return <SafeAreaView style={s.c} edges={['top','bottom']}><View style={s.header}><TouchableOpacity onPress={()=>router.back()}><Text style={s.back}>‹</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.kicker}>DISCOVER</Text><Text style={s.title}>Find your vibe</Text></View></View><View style={s.search}><Text style={s.mag}>⌕</Text><TextInput autoFocus value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder="Search songs, artists, videos, playlists..." placeholderTextColor="#6f6c78" style={s.input} returnKeyType="search"/><TouchableOpacity onPress={search} disabled={loading}><Text style={s.go}>{loading?'…':'Go'}</Text></TouchableOpacity></View><View style={s.tabs}>{(['all','music','video'] as const).map(x=><TouchableOpacity key={x} style={[s.tab,kind===x&&s.tabOn]} onPress={()=>{setKind(x);setResults([]);setError(youtubeConfigured()?'':'Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env.local and restart Expo.')}}><Text style={[s.tabText,kind===x&&s.tabTextOn]}>{x==='all'?'Everything':x==='music'?'🎵 Music':'🎬 Videos'}</Text></TouchableOpacity>)}</View>{error?<View style={s.notice}><Text style={s.noticeTitle}>Search setup</Text><Text style={s.noticeText}>{error}</Text></View>:null}<ScrollView contentContainerStyle={s.list}>{loading?<ActivityIndicator size="large"/>:results.map(item=><ResultCard key={item.id+item.kind} item={item} roomCode={params.roomCode}/>) }{!loading&&!results.length&&!error?<Text style={s.empty}>Search for a song, artist, video or playlist.</Text>:null}</ScrollView></SafeAreaView>;
}
function ResultCard({item,roomCode}:{item:YouTubeResult;roomCode?:string}){
  const [adding,setAdding]=useState(false);
  async function selectResult(){
    if(!roomCode){
      router.push({pathname:'/create',params:{videoId:item.kind==='playlist'?'':item.id,playlistId:item.playlistId??'',title:item.title,channel:item.channelTitle,thumbnail:item.thumbnail,kind:item.kind}} as any);
      return;
    }
    if(adding)return;
    setAdding(true);
    try{
      if(item.kind==='playlist'){
        const items=await getPlaylistItems(item.playlistId??item.id);
        if(!items.length)throw new Error('No playable videos were found in this playlist.');
        await appendQueueItems(roomCode,items);
      }else{
        const queueItem:QueueItem={id:item.id,videoId:item.id,title:item.title,channelTitle:item.channelTitle,thumbnail:item.thumbnail,duration:item.duration,kind:item.kind};
        await addQueueItem(roomCode,queueItem);
      }
      router.back();
    }catch(e){
      Alert.alert('Could not add to queue',e instanceof Error?e.message:'Please try again.');
    }finally{
      setAdding(false);
    }
  }
  return <TouchableOpacity style={s.card} onPress={()=>void selectResult()} disabled={adding}><Image source={{uri:item.thumbnail}} style={s.thumb}/><View style={s.meta}><View style={s.badgeRow}><Text style={s.type}>{item.kind==='playlist'?'PLAYLIST':item.kind==='music'?'MUSIC':'VIDEO'}</Text>{item.duration?<Text style={s.duration}>{item.duration}</Text>:null}</View><Text numberOfLines={2} style={s.cardTitle}>{item.title}</Text><Text numberOfLines={1} style={s.channel}>{adding?'Adding to queue…':item.channelTitle}</Text></View><Text style={s.plus}>{adding?'…':item.kind==='playlist'?'›':'＋'}</Text></TouchableOpacity>;
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#08070d',paddingHorizontal:18,paddingTop:10},header:{flexDirection:'row',alignItems:'center',marginTop:8,marginBottom:20},back:{color:'#fff',fontSize:38,marginRight:10,lineHeight:38},kicker:{color:'#a78bfa',fontSize:9,fontWeight:'900',letterSpacing:2.2},title:{color:'#fff',fontSize:30,fontWeight:'900',marginTop:4,letterSpacing:-.7},search:{height:60,backgroundColor:'#171522',borderRadius:18,borderWidth:1,borderColor:'#4a3a62',flexDirection:'row',alignItems:'center',paddingHorizontal:14,shadowColor:'#8b5cf6',shadowOpacity:.08,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:2},mag:{fontSize:25,color:'#a78bfa',marginRight:8},input:{flex:1,color:'#fff',fontSize:15},go:{color:'#c4b5fd',fontWeight:'900',backgroundColor:'#302047',overflow:'hidden',paddingHorizontal:12,paddingVertical:9,borderRadius:10},tabs:{flexDirection:'row',gap:8,marginTop:14,marginBottom:20},tab:{paddingHorizontal:16,paddingVertical:10,borderRadius:999,backgroundColor:'#15131d',borderWidth:1,borderColor:'#292536'},tabOn:{backgroundColor:'#382363',borderColor:'#7250aa'},tabText:{color:'#777481',fontWeight:'700'},tabTextOn:{color:'#ddd0ff'},notice:{backgroundColor:'#171128',borderWidth:1,borderColor:'#4c2d83',padding:14,borderRadius:16},noticeTitle:{color:'#fff',fontWeight:'800'},noticeText:{color:'#aaa3b6',marginTop:5,lineHeight:19},list:{paddingBottom:30,gap:10},empty:{color:'#91889e',textAlign:'center',marginTop:60,lineHeight:21,paddingHorizontal:20,fontSize:13},card:{flexDirection:'row',alignItems:'center',backgroundColor:'#13111b',borderRadius:18,padding:9,borderWidth:1,borderColor:'#30283d',minHeight:96},thumb:{width:118,height:76,borderRadius:12,backgroundColor:'#201d27'},meta:{flex:1,paddingHorizontal:11},badgeRow:{flexDirection:'row',gap:8,alignItems:'center'},type:{color:'#a78bfa',fontSize:9,fontWeight:'900',letterSpacing:1},duration:{color:'#65616d',fontSize:10},cardTitle:{color:'#fff',fontSize:14,fontWeight:'800',lineHeight:19,marginTop:5},channel:{color:'#908c99',fontSize:12,marginTop:4},plus:{color:'#c4b5fd',fontSize:27,paddingHorizontal:8}});