import 'dart:math';

const _alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ2346789';

String generateRoomCode({int length = 6}) {
  final random = Random.secure();
  return List.generate(length, (_) => _alphabet[random.nextInt(_alphabet.length)]).join();
}
