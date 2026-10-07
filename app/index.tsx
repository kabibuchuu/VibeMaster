import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ensureAnonymousAuth, watchAuth } from '../src/lib/auth';

export default function Home(){
 const [code,setCode]=useState('');
 const [ready,setReady]=useState(false);
 useEffect(()=>{const u=watchAuth(()=>setReady(true)); ensureAnonymousAuth().catch(console.error); return u;},[]);
 if(!ready)return <SafeAreaView style={s.center}><ActivityIndicator/><Text style={s.muted}>Connecting…</Text></SafeAreaView>;
 return <SafeAreaView style={s.container}><View style={s.hero}><Text style={s.logo}>VibeMaster</Text><Text style={s.subtitle}>Listen together. Stay in sync.</Text></View>
 <View style={s.card}><Text style={s.heading}>Join a room</Text><TextInput value={code} onChangeText={v=>setCode(v.toUpperCase())} placeholder="ROOM CODE" placeholderTextColor="#777" autoCapitalize="characters" style={s.input} maxLength={8}/>
 <TouchableOpacity style={s.primary} onPress={()=>code.trim()&&router.push({pathname:'/room',params:{code:code.trim()}})}><Text style={s.primaryText}>Join Room</Text></TouchableOpacity>
 <Text style={s.or}>or</Text><TouchableOpacity style={s.secondary} onPress={()=>router.push('/create')}><Text style={s.secondaryText}>Create a Room</Text></TouchableOpacity></View></SafeAreaView>
}
const s=StyleSheet.create({container:{flex:1,backgroundColor:'#0b0712',padding:24},center:{flex:1,backgroundColor:'#0b0712',alignItems:'center',justifyContent:'center',gap:10},hero:{marginTop:80,marginBottom:50},logo:{fontSize:42,fontWeight:'800',color:'#a78bfa'},subtitle:{color:'#aaa',fontSize:16,marginTop:8},card:{backgroundColor:'#17111f',padding:20,borderRadius:20},heading:{color:'#fff',fontSize:22,fontWeight:'700',marginBottom:16},input:{backgroundColor:'#0e0a14',color:'#fff',borderRadius:12,padding:16,fontSize:18,letterSpacing:3,marginBottom:12},primary:{backgroundColor:'#7c3aed',padding:16,borderRadius:12,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'700'},or:{color:'#777',textAlign:'center',marginVertical:14},secondary:{borderWidth:1,borderColor:'#555',padding:16,borderRadius:12,alignItems:'center'},secondaryText:{color:'#fff',fontWeight:'600'},muted:{color:'#888'}});