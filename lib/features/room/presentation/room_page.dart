import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import '../../../core/providers.dart';
import '../domain/room.dart';

class RoomPage extends ConsumerStatefulWidget {
  const RoomPage({super.key, required this.roomId, required this.displayName});
  final String roomId; final String displayName;
  @override ConsumerState<RoomPage> createState() => _RoomPageState();
}

class _RoomPageState extends ConsumerState<RoomPage> {
  YoutubePlayerController? _player;
  StreamSubscription<YoutubeVideoState>? _playerEvents;
  Timer? _heartbeat;
  bool _remoteChange = false;
  int _appliedVersion = -1;
  String? _appliedVideoId;
  DateTime _lastWrite = DateTime.fromMillisecondsSinceEpoch(0);

  @override void initState() { super.initState(); _heartbeat = Timer.periodic(const Duration(seconds: 2), (_) => _hostHeartbeat()); }
  @override void dispose() { _heartbeat?.cancel(); _playerEvents?.cancel(); _player?.close(); super.dispose(); }

  void _ensurePlayer(String videoId) {
    if (_player != null) return;
    final p = YoutubePlayerController.fromVideoId(videoId: videoId, autoPlay: false, params: const YoutubePlayerParams(showControls: true, showFullscreenButton: true, privacyEnhancedMode: true));
    _player = p;
    _playerEvents = p.videoStateStream.listen((state) {
      if (_remoteChange) return;
      if (state.playerState == PlayerState.playing) _writeState('playing');
      if (state.playerState == PlayerState.paused) _writeState('paused');
    });
  }

  Future<Room?> _roomOnce() async {
    final snap = await ref.read(roomRepositoryProvider).watchRoom(widget.roomId).first;
    return snap.exists ? Room.fromSnapshot(snap) : null;
  }

  Future<void> _writeState(String status) async {
    if (_remoteChange || _player == null) return;
    final room = await _roomOnce(); final uid = ref.read(authRepositoryProvider).currentUser?.uid;
    if (room == null || room.hostId != uid) return;
    final pos = await _player!.currentTime;
    await ref.read(roomRepositoryProvider).updatePlayback(widget.roomId, status: status, position: pos);
    _lastWrite = DateTime.now();
  }

  Future<void> _hostHeartbeat() async {
    if (!mounted || _remoteChange || _player == null || DateTime.now().difference(_lastWrite) < const Duration(seconds: 4)) return;
    final room = await _roomOnce(); final uid = ref.read(authRepositoryProvider).currentUser?.uid;
    if (room == null || room.hostId != uid || !room.isPlaying) return;
    final pos = await _player!.currentTime;
    await ref.read(roomRepositoryProvider).updatePlayback(widget.roomId, status: 'playing', position: pos);
    _lastWrite = DateTime.now();
  }

  Future<void> _applyRoom(Room room) async {
    if (room.videoId == null || room.version <= _appliedVersion) return;
    _ensurePlayer(room.videoId!);
    _remoteChange = true;
    try {
      if (_appliedVideoId != room.videoId) {
        await _player!.loadVideoById(videoId: room.videoId!, startSeconds: room.position);
        _appliedVideoId = room.videoId;
      } else {
        var position = room.position;
        if (room.isPlaying && room.updatedAt != null) position += DateTime.now().difference(room.updatedAt!.toDate()).inMilliseconds / 1000;
        await _player!.seekTo(seconds: position.clamp(0.0, double.infinity).toDouble());
      }
      if (room.isPlaying) await _player!.playVideo(); else await _player!.pauseVideo();
      _appliedVersion = room.version;
    } finally { _remoteChange = false; }
  }

  Future<void> _chooseVideo() async {
    final c = TextEditingController();
    final value = await showDialog<String>(context: context, builder: (context) => AlertDialog(title: const Text('YouTube video'), content: TextField(controller: c, autofocus: true, decoration: const InputDecoration(hintText: 'Paste URL or video ID')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, c.text.trim()), child: const Text('Use video'))]));
    c.dispose(); if (value == null || value.isEmpty) return;
    final id = YoutubePlayerController.convertUrlToId(value) ?? value;
    if (id.length < 6) return;
    await ref.read(roomRepositoryProvider).setVideo(widget.roomId, id);
  }

  Future<void> _sync(Room room) async {
    if (_player == null) return;
    _remoteChange = true;
    try {
      var position = room.position;
      if (room.isPlaying && room.updatedAt != null) position += DateTime.now().difference(room.updatedAt!.toDate()).inMilliseconds / 1000;
      await _player!.seekTo(seconds: position.clamp(0.0, double.infinity).toDouble());
      if (room.isPlaying) await _player!.playVideo(); else await _player!.pauseVideo();
    } finally { _remoteChange = false; }
  }

  Future<void> _addToQueue() async {
    final c = TextEditingController();
    final value = await showDialog<String>(context: context, builder: (context) => AlertDialog(title: const Text('Add to queue'), content: TextField(controller: c, autofocus: true, decoration: const InputDecoration(hintText: 'YouTube URL or video ID')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, c.text.trim()), child: const Text('Add'))]));
    c.dispose(); if (value == null || value.isEmpty) return;
    final id = YoutubePlayerController.convertUrlToId(value) ?? value;
    if (id.length < 6) return;
    final uid = ref.read(authRepositoryProvider).currentUser?.uid; if (uid == null) return;
    await ref.read(roomRepositoryProvider).addToQueue(widget.roomId, videoId: id, title: 'YouTube video', addedBy: uid);
  }

  Future<void> _chat() async {
    final c = TextEditingController();
    final text = await showDialog<String>(context: context, builder: (context) => AlertDialog(title: const Text('Chat'), content: TextField(controller: c, autofocus: true, maxLength: 300, decoration: const InputDecoration(hintText: 'Say something…')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, c.text.trim()), child: const Text('Send'))]));
    c.dispose(); if (text == null || text.isEmpty) return;
    final uid = ref.read(authRepositoryProvider).currentUser?.uid; if (uid == null) return;
    await ref.read(roomRepositoryProvider).sendMessage(widget.roomId, userId: uid, displayName: widget.displayName, text: text);
  }

  @override
  Widget build(BuildContext context) => StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(stream: ref.read(roomRepositoryProvider).watchRoom(widget.roomId), builder: (context, snapshot) {
    if (snapshot.hasError) return Scaffold(body: Center(child: Text('Room error: ${snapshot.error}')));
    if (!snapshot.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!snapshot.data!.exists) return const Scaffold(body: Center(child: Text('This room no longer exists.')));
    final room = Room.fromSnapshot(snapshot.data!);
    final isHost = room.hostId == ref.read(authRepositoryProvider).currentUser?.uid;
    if (!isHost) WidgetsBinding.instance.addPostFrameCallback((_) => _applyRoom(room));
    return Scaffold(
      appBar: AppBar(title: Text('Room ${room.code}'), actions: [IconButton(onPressed: _chat, icon: const Icon(Icons.chat_bubble_outline)), IconButton(onPressed: () => _sync(room), icon: const Icon(Icons.sync))]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ClipRRect(borderRadius: BorderRadius.circular(16), child: AspectRatio(aspectRatio: 16/9, child: _player == null ? Container(color: Colors.black, child: Center(child: Text(isHost ? 'Add a YouTube video' : 'Waiting for the host…', style: const TextStyle(color: Colors.white)))) : YoutubePlayer(controller: _player!))),
        const SizedBox(height: 12),
        Row(children: [Icon(room.isPlaying ? Icons.play_circle : Icons.pause_circle, size: 20), const SizedBox(width: 8), Text(room.isPlaying ? 'Playing together' : 'Paused together'), const Spacer(), if (isHost) FilledButton.tonalIcon(onPressed: _chooseVideo, icon: const Icon(Icons.video_library_outlined), label: Text(room.videoId == null ? 'Add video' : 'Change'))]),
        const SizedBox(height: 16),
        _Participants(roomId: widget.roomId),
        const SizedBox(height: 12),
        _Queue(roomId: widget.roomId, isHost: isHost),
        const SizedBox(height: 8),
        OutlinedButton.icon(onPressed: _addToQueue, icon: const Icon(Icons.playlist_add), label: const Text('Add a video to the queue')),
        const SizedBox(height: 12),
        _Messages(roomId: widget.roomId),
      ])),
    );
  });
}

class _Participants extends ConsumerWidget { const _Participants({required this.roomId}); final String roomId;
  @override Widget build(BuildContext context, WidgetRef ref) => StreamBuilder<QuerySnapshot<Map<String,dynamic>>>(stream: ref.read(roomRepositoryProvider).watchParticipants(roomId), builder: (context,s) { final docs=s.data?.docs??[]; return Card(child: ExpansionTile(leading:const Icon(Icons.people_outline),title:Text('${docs.length} ${docs.length==1?'person':'people'}'),children:[Padding(padding:const EdgeInsets.fromLTRB(16,0,16,16),child:Wrap(spacing:8,runSpacing:8,children:docs.map((d)=>Chip(label:Text(d.data()['displayName'] as String? ?? 'Guest'))).toList()))])); }); }
}

class _Queue extends ConsumerWidget { const _Queue({required this.roomId,required this.isHost}); final String roomId; final bool isHost;
  @override Widget build(BuildContext context, WidgetRef ref) => Card(child: ExpansionTile(leading:const Icon(Icons.queue_music),title:const Text('Queue'),children:[StreamBuilder<QuerySnapshot<Map<String,dynamic>>>(stream:ref.read(roomRepositoryProvider).watchQueue(roomId),builder:(context,s){final docs=s.data?.docs??[];if(docs.isEmpty)return const Padding(padding:EdgeInsets.all(16),child:Text('Nothing queued yet.'));return Column(children:docs.map((d)=>ListTile(title:Text(d.data()['title'] as String? ?? 'YouTube video'),subtitle:Text(d.data()['videoId'] as String? ?? ''),trailing:isHost?IconButton(icon:const Icon(Icons.delete_outline),onPressed:()=>ref.read(roomRepositoryProvider).removeQueueItem(roomId,d.id)):null)).toList());})])); }
}

class _Messages extends ConsumerWidget { const _Messages({required this.roomId}); final String roomId;
  @override Widget build(BuildContext context, WidgetRef ref) => Card(child: ExpansionTile(leading:const Icon(Icons.forum_outlined),title:const Text('Chat'),children:[SizedBox(height:220,child:StreamBuilder<QuerySnapshot<Map<String,dynamic>>>(stream:ref.read(roomRepositoryProvider).watchMessages(roomId),builder:(context,s){final docs=s.data?.docs??[];if(docs.isEmpty)return const Center(child:Text('No messages yet.'));return ListView.builder(reverse:true,itemCount:docs.length,itemBuilder:(context,i){final d=docs[i].data();return ListTile(dense:true,title:Text(d['displayName'] as String? ?? 'Guest',style:const TextStyle(fontWeight:FontWeight.bold)),subtitle:Text(d['text'] as String? ?? ''));});}))])); }
}
