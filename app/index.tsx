import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ensureAnonymousAuth, watchAuth } from '../src/lib/auth';

export default function Home() {
  const [code, setCode] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => { const unsub = watchAuth(() => setReady(true)); ensureAnonymousAuth().catch(console.error); return unsub; }, []);
  if (!ready) return <SafeAreaView style={s.center} edges={['top','bottom']}><ActivityIndicator/><Text style={s.muted}>Getting your vibe ready…</Text></SafeAreaView>;
  return (
    <SafeAreaView style={s.safe} edges={['top','bottom']}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.topbar}>
          <View style={s.brandMark}><Text style={s.brandGlyph}>V</Text></View>
          <View style={s.brandCopy}><Text style={s.brandName}>VIBEMASTER</Text><Text style={s.brandTag}>TOGETHER SOUNDS BETTER</Text></View>
          <View style={s.livePill}><View style={s.liveDot}/><Text style={s.liveText}>IN SYNC</Text></View>
        </View>
        <View style={s.hero}>
          <View style={s.heroGlow}/>
          <Text style={s.badge}>YOUR SHARED SPACE</Text>
          <Text style={s.title}>Press play.{"\n"}Bring everyone in.</Text>
          <Text style={s.sub}>One room, one queue, one vibe. Watch and listen together in real time.</Text>
          <TouchableOpacity style={s.heroAction} onPress={() => router.push('/create')}><Text style={s.heroActionText}>＋  Start a room</Text><Text style={s.heroArrow}>↗</Text></TouchableOpacity>
          <View style={s.heroFoot}><Text style={s.heroFootText}>MUSIC</Text><View style={s.footLine}/><Text style={s.heroFootText}>VIDEOS</Text><View style={s.footLine}/><Text style={s.heroFootText}>FRIENDS</Text></View>
        </View>
        <TouchableOpacity style={s.search} onPress={() => router.push('/search')}><View style={s.searchIconWrap}><Text style={s.searchIcon}>⌕</Text></View><View style={{flex:1}}><Text style={s.searchLabel}>DISCOVER SOMETHING</Text><Text style={s.placeholder}>Songs, videos, artists & playlists</Text></View><Text style={s.searchArrow}>→</Text></TouchableOpacity>
        <View style={s.sectionHead}><Text style={s.sectionTitle}>Pick your mood</Text><Text style={s.sectionHint}>EXPLORE</Text></View>
        <View style={s.quick}>
          <TouchableOpacity style={[s.quickCard,s.musicCard]} onPress={() => router.push({pathname:'/search',params:{kind:'music'}})}><View style={s.tileTop}><Text style={s.qIcon}>♫</Text><Text style={s.tileArrow}>↗</Text></View><Text style={s.qTitle}>Music</Text><Text style={s.qSub}>Set the soundtrack</Text><View style={s.tileBars}><View style={[s.bar,{height:9}]}/><View style={[s.bar,{height:18}]}/><View style={[s.bar,{height:12}]}/><View style={[s.bar,{height:24}]}/><View style={[s.bar,{height:15}]}/><View style={[s.bar,{height:7}]}/></View></TouchableOpacity>
          <TouchableOpacity style={[s.quickCard,s.videoCard]} onPress={() => router.push({pathname:'/search',params:{kind:'video'}})}><View style={s.tileTop}><Text style={s.qIcon}>▷</Text><Text style={s.tileArrow}>↗</Text></View><Text style={s.qTitle}>Watch party</Text><Text style={s.qSub}>Make it a moment</Text><View style={s.videoShapes}><View style={s.videoShapeOne}/><View style={s.videoShapeTwo}/><View style={s.videoShapeThree}/></View></TouchableOpacity>
        </View>
        <View style={s.join}>
          <View style={s.joinHeader}><View><Text style={s.joinTitle}>Got a room code?</Text><Text style={s.joinSub}>Jump back in with your friends.</Text></View><View style={s.joinIcon}><Text style={s.joinIconText}>⌁</Text></View></View>
          <View style={s.joinRow}><TextInput value={code} onChangeText={v=>setCode(v.toUpperCase())} placeholder="ENTER ROOM CODE" placeholderTextColor="#6f6a7c" autoCapitalize="characters" style={s.input} maxLength={8}/><TouchableOpacity style={s.joinBtn} onPress={() => code.trim()&&router.push({pathname:'/room',params:{code:code.trim()}})}><Text style={s.joinText}>Join room →</Text></TouchableOpacity></View>
        </View>
        <Text style={s.footer}>MADE FOR SHARED MOMENTS <Text style={s.footerSpark}>✦</Text></Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#08070d'},page:{paddingHorizontal:22,paddingTop:12,paddingBottom:28},
 topbar:{flexDirection:'row',alignItems:'center',marginBottom:22},brandMark:{width:42,height:42,borderRadius:14,backgroundColor:'#8b5cf6',alignItems:'center',justifyContent:'center',shadowColor:'#8b5cf6',shadowOpacity:.35,shadowRadius:14,shadowOffset:{width:0,height:4},elevation:5},brandGlyph:{color:'#fff',fontSize:24,fontWeight:'900'},brandCopy:{marginLeft:11,flex:1},brandName:{color:'#fff',fontSize:13,fontWeight:'900',letterSpacing:2},brandTag:{color:'#777184',fontSize:8,fontWeight:'800',letterSpacing:1.5,marginTop:4},livePill:{flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'#302644',backgroundColor:'#151020',paddingHorizontal:10,paddingVertical:7,borderRadius:999},liveDot:{width:6,height:6,borderRadius:3,backgroundColor:'#a78bfa'},liveText:{color:'#c4b5fd',fontSize:8,fontWeight:'900',letterSpacing:1},
 hero:{position:'relative',overflow:'hidden',backgroundColor:'#171027',borderRadius:28,padding:23,borderWidth:1,borderColor:'#392855',minHeight:290},heroGlow:{position:'absolute',width:220,height:220,borderRadius:110,backgroundColor:'#422477',right:-90,top:-70,opacity:.55},badge:{color:'#c4b5fd',fontSize:9,fontWeight:'900',letterSpacing:2.2},title:{color:'#fff',fontSize:36,fontWeight:'900',lineHeight:40,marginTop:18,letterSpacing:-1.1},sub:{color:'#b0a7c0',fontSize:13,lineHeight:20,marginTop:13,maxWidth:280},heroAction:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#9b6bff',borderRadius:14,paddingHorizontal:16,paddingVertical:13,marginTop:22},heroActionText:{color:'#fff',fontSize:13,fontWeight:'900'},heroArrow:{color:'#fff',fontSize:18,fontWeight:'800'},heroFoot:{flexDirection:'row',alignItems:'center',gap:9,marginTop:20},heroFootText:{color:'#8f82a5',fontSize:8,fontWeight:'900',letterSpacing:1.4},footLine:{height:1,width:20,backgroundColor:'#55416f'},
 search:{minHeight:76,borderRadius:19,backgroundColor:'#12101a',borderWidth:1,borderColor:'#2c263a',flexDirection:'row',alignItems:'center',paddingHorizontal:13,marginTop:16},searchIconWrap:{width:42,height:42,borderRadius:13,backgroundColor:'#211831',alignItems:'center',justifyContent:'center',marginRight:12},searchIcon:{color:'#c4b5fd',fontSize:28},searchLabel:{color:'#8f83a7',fontSize:8,fontWeight:'900',letterSpacing:1.5,marginBottom:5},placeholder:{color:'#d4cfdf',fontSize:12,fontWeight:'700'},searchArrow:{color:'#a78bfa',fontSize:22,marginHorizontal:5},
 sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:26,marginBottom:12},sectionTitle:{color:'#f7f4ff',fontSize:19,fontWeight:'900',letterSpacing:-.4},sectionHint:{color:'#71677f',fontSize:9,fontWeight:'900',letterSpacing:1.5},quick:{flexDirection:'row',gap:12},quickCard:{flex:1,minHeight:170,overflow:'hidden',padding:16,borderRadius:21,borderWidth:1,borderColor:'#30253f'},musicCard:{backgroundColor:'#191127'},videoCard:{backgroundColor:'#111725',borderColor:'#26364a'},tileTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},qIcon:{fontSize:27,color:'#d5bfff',fontWeight:'900'},tileArrow:{color:'#83759a',fontSize:16},qTitle:{color:'#fff',fontSize:16,fontWeight:'900',marginTop:15},qSub:{color:'#a49aaf',fontSize:11,marginTop:5},tileBars:{flexDirection:'row',alignItems:'flex-end',gap:4,marginTop:17,height:25},bar:{width:5,borderRadius:4,backgroundColor:'#a78bfa'},videoShapes:{height:28,flexDirection:'row',alignItems:'center',marginTop:14,gap:5},videoShapeOne:{height:22,width:40,borderRadius:6,backgroundColor:'#49617e'},videoShapeTwo:{height:28,width:48,borderRadius:6,backgroundColor:'#6e55a4'},videoShapeThree:{height:17,width:28,borderRadius:5,backgroundColor:'#34455d'},
 join:{marginTop:22,backgroundColor:'#111019',borderWidth:1,borderColor:'#292438',borderRadius:21,padding:16},joinHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},joinTitle:{color:'#f0ebf8',fontWeight:'900',fontSize:15},joinSub:{color:'#8e8799',fontSize:11,marginTop:4},joinIcon:{width:38,height:38,borderRadius:13,backgroundColor:'#211831',alignItems:'center',justifyContent:'center'},joinIconText:{color:'#c4b5fd',fontSize:26},joinRow:{flexDirection:'row',gap:9},input:{flex:1,minWidth:0,backgroundColor:'#09080f',color:'#fff',borderRadius:13,paddingHorizontal:12,fontSize:12,fontWeight:'800',letterSpacing:1.5,borderWidth:1,borderColor:'#2d2739'},joinBtn:{backgroundColor:'#8b5cf6',paddingHorizontal:14,borderRadius:13,justifyContent:'center'},joinText:{color:'#fff',fontSize:11,fontWeight:'900'},footer:{color:'#51495f',textAlign:'center',fontSize:8,fontWeight:'900',letterSpacing:1.8,marginTop:22},footerSpark:{color:'#a78bfa'},
 center:{flex:1,backgroundColor:'#08070d',alignItems:'center',justifyContent:'center',gap:10},muted:{color:'#777481'}
});
