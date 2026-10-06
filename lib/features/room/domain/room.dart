import 'package:cloud_firestore/cloud_firestore.dart';

enum RoomPlaybackStatus { idle, playing, paused }

class Room {
  const Room({required this.id, required this.code, required this.hostId, required this.status, required this.position, this.videoId, this.version = 0, this.updatedAt});
  final String id;
  final String code;
  final String hostId;
  final RoomPlaybackStatus status;
  final double position;
  final String? videoId;
  final int version;
  final Timestamp? updatedAt;
  bool get isPlaying => status == RoomPlaybackStatus.playing;

  factory Room.fromSnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final data = snap.data()!;
    final status = switch (data['status'] as String? ?? 'idle') {
      'playing' => RoomPlaybackStatus.playing,
      'paused' => RoomPlaybackStatus.paused,
      _ => RoomPlaybackStatus.idle,
    };
    return Room(id: snap.id, code: data['code'] as String? ?? '', hostId: data['hostId'] as String? ?? '', status: status, position: (data['position'] as num?)?.toDouble() ?? 0, videoId: data['videoId'] as String?, version: (data['version'] as num?)?.toInt() ?? 0, updatedAt: data['updatedAt'] as Timestamp?);
  }
}
