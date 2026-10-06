import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/auth_repository.dart';
import '../features/room/data/room_repository.dart';

final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);
final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository(ref.watch(firebaseAuthProvider)));
final roomRepositoryProvider = Provider<RoomRepository>((ref) => RoomRepository(ref.watch(firestoreProvider)));
