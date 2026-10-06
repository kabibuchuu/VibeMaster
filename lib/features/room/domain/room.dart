enum RoomPlaybackStatus { idle, playing, paused }

class Room {
  const Room({
    required this.id,
    required this.code,
    required this.hostId,
    required this.status,
    required this.position,
    this.videoId,
    this.version = 0,
  });

  final String id;
  final String code;
  final String hostId;
  final RoomPlaybackStatus status;
  final double position;
  final String? videoId;
  final int version;

  bool get isPlaying => status == RoomPlaybackStatus.playing;
}
