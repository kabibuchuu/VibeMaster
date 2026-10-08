import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ensureAnonymousAuth, watchAuth } from '../src/lib/auth';

export default function Home() {
  const [code, setCode] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => { const unsub = watchAuth(() => setReady(true)); ensureAnonymousAuth().catch(console.error); return unsub; }, []);
  if (!ready) return <SafeAreaView style={s.center} edges={['top','bottom']}><ActivityIndicator/><Text style={s.muted}>Getting your vibe ready…</Text></SafeAreaView>;
  return (
    <SafeAreaView style={s.c} edges={['top','bottom']}>
      <View style={s.hero}>
        <Text style={s.badge}>VIBEMASTER</Text>
        <Text style={s.title}>Your night.{"\n"}Your people.{"\n"}Your vibe.</Text>
        <Text style={s.sub}>Listen, watch and discover together — perfectly in sync.</Text>
      </View>
      <TouchableOpacity style={s.search} onPress={() => router.push('/search')}><Text style={s.searchIcon}>⌕</Text><Text style={s.placeholder}>Search songs, videos & playlists</Text></TouchableOpacity>
      <View style={s.quick}>
        <TouchableOpacity style={s.quickCard} onPress={() => router.push({pathname:'/search',params:{kind:'music'}})}><Text style={s.qIcon}>🎵</Text><Text style={s.qTitle}>Music</Text><Text style={s.qSub}>Find something to feel</Text></TouchableOpacity>
        <TouchableOpacity style={s.quickCard} onPress={() => router.push({pathname:'/search',params:{kind:'video'}})}><Text style={s.qIcon}>🎬</Text><Text style={s.qTitle}>Videos</Text><Text style={s.qSub}>Find something to watch</Text></TouchableOpacity>
      </View>
      <View style={s.join}><Text style={s.joinTitle}>Joining friends?</Text><View style={s.joinRow}><TextInput value={code} onChangeText={v=>setCode(v.toUpperCase())} placeholder="ROOM CODE" placeholderTextColor="#555" autoCapitalize="characters" style={s.input} maxLength={8}/><TouchableOpacity style={s.joinBtn} onPress={()=>code.trim()&&router.push({pathname:'/room',params:{code:code.trim()}})}><Text style={s.joinText}>Join</Text></TouchableOpacity></View></View>
      <TouchableOpacity style={s.create} onPress={()=>router.push('/create')}><Text style={s.createText}>＋ Create a new vibe</Text></TouchableOpacity>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:'#08070d',padding:22},center:{flex:1,backgroundColor:'#08070d',alignItems:'center',justifyContent:'center',gap:10},hero:{marginTop:38},badge:{color:'#a78bfa',fontSize:12,fontWeight:'900',letterSpacing:3},title:{color:'#fff',fontSize:42,fontWeight:'900',lineHeight:46,marginTop:12},sub:{color:'#8d8a98',fontSize:16,lineHeight:23,marginTop:14},search:{height:60,borderRadius:18,backgroundColor:'#15131d',borderWidth:1,borderColor:'#272431',flexDirection:'row',alignItems:'center',paddingHorizontal:17,marginTop:30},searchIcon:{color:'#c4b5fd',fontSize:28,marginRight:10},placeholder:{color:'#777481',fontSize:15},quick:{flexDirection:'row',gap:12,marginTop:14},quickCard:{flex:1,backgroundColor:'#111019',padding:17,borderRadius:20,borderWidth:1,borderColor:'#211e29'},qIcon:{fontSize:25},qTitle:{color:'#fff',fontSize:17,fontWeight:'800',marginTop:12},qSub:{color:'#777481',fontSize:12,marginTop:4},join:{marginTop:26},joinTitle:{color:'#d4d0db',fontWeight:'700',marginBottom:10},joinRow:{flexDirection:'row',gap:10},input:{flex:1,backgroundColor:'#111019',color:'#fff',borderRadius:16,paddingHorizontal:16,fontWeight:'800',letterSpacing:2},joinBtn:{backgroundColor:'#8b5cf6',paddingHorizontal:20,borderRadius:16,justifyContent:'center'},joinText:{color:'#fff',fontWeight:'800'},create:{marginTop:'auto',alignItems:'center',padding:16},createText:{color:'#c4b5fd',fontWeight:'800'},muted:{color:'#777481'}});
