import 'package:cloud_firestore/cloud_firestore.dart';

import '../domain/room.dart';
import 'room_code.dart';

class RoomRepository {
  RoomRepository(this._firestore);

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _rooms => _firestore.collection('rooms');

  Future<String> createRoom({required String hostId, required String displayName}) async {
    for (var attempt = 0; attempt < 5; attempt++) {
      final code = generateRoomCode();
      final query = await _rooms.where('code', isEqualTo: code).limit(1).get();
      if (query.docs.isNotEmpty) continue;

      final room = _rooms.doc();
      final participant = room.collection('participants').doc(hostId);
      final batch = _firestore.batch();
      batch.set(room, {
        'code': code,
        'hostId': hostId,
        'videoId': null,
        'status': 'idle',
        'position': 0.0,
        'version': 0,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      batch.set(participant, {
        'displayName': displayName,
        'joinedAt': FieldValue.serverTimestamp(),
        'lastSeenAt': FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return room.id;
    }
    throw StateError('Could not generate a unique room code. Please try again.');
  }

  Future<String> joinRoom({required String code, required String userId, required String displayName}) async {
    final result = await _rooms.where('code', isEqualTo: code.trim().toUpperCase()).limit(1).get();
    if (result.docs.isEmpty) throw StateError('Room not found. Check the room code.');
    final room = result.docs.single.reference;
    await room.collection('participants').doc(userId).set({
      'displayName': displayName,
      'joinedAt': FieldValue.serverTimestamp(),
      'lastSeenAt': FieldValue.serverTimestamp(),
    });
    return room.id;
  }

  Stream<DocumentSnapshot<Map<String, dynamic>>> watchRoom(String roomId) => _rooms.doc(roomId).snapshots();
}
