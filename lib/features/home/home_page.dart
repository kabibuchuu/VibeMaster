import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../room/presentation/room_page.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  Future<String?> _askName(BuildContext context) async {
    final c = TextEditingController();
    final result = await showDialog<String>(context: context, builder: (context) => AlertDialog(
      title: const Text('What should we call you?'),
      content: TextField(controller: c, autofocus: true, maxLength: 24, decoration: const InputDecoration(hintText: 'Your name')),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () { if (c.text.trim().isNotEmpty) Navigator.pop(context, c.text.trim()); }, child: const Text('Continue'))],
    ));
    c.dispose();
    return result;
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final name = await _askName(context); if (name == null) return;
    try {
      final user = await ref.read(authRepositoryProvider).ensureSignedIn();
      final id = await ref.read(roomRepositoryProvider).createRoom(hostId: user.uid, displayName: name);
      if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => RoomPage(roomId: id, displayName: name)));
    } catch (e) { if (context.mounted) _showError(context, e); }
  }

  Future<void> _join(BuildContext context, WidgetRef ref) async {
    final code = TextEditingController(); final name = TextEditingController();
    final values = await showDialog<List<String>>(context: context, builder: (context) => AlertDialog(
      title: const Text('Join a room'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: code, textCapitalization: TextCapitalization.characters, maxLength: 6, decoration: const InputDecoration(labelText: 'Room code')), const SizedBox(height: 12), TextField(controller: name, maxLength: 24, decoration: const InputDecoration(labelText: 'Your name'))]),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () { if (code.text.trim().isNotEmpty && name.text.trim().isNotEmpty) Navigator.pop(context, [code.text.trim(), name.text.trim()]); }, child: const Text('Join'))],
    ));
    code.dispose(); name.dispose(); if (values == null) return;
    try {
      final user = await ref.read(authRepositoryProvider).ensureSignedIn();
      final id = await ref.read(roomRepositoryProvider).joinRoom(code: values[0], userId: user.uid, displayName: values[1]);
      if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => RoomPage(roomId: id, displayName: values[1])));
    } catch (e) { if (context.mounted) _showError(context, e); }
  }

  void _showError(BuildContext context, Object error) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString().replaceFirst('Bad state: ', ''))));

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: SafeArea(child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520), child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    Container(width: 96, height: 96, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primaryContainer, borderRadius: BorderRadius.circular(28)), child: Icon(Icons.headphones_rounded, size: 52, color: Theme.of(context).colorScheme.primary)),
    const SizedBox(height: 24), Text('VibeMaster', style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800)),
    const SizedBox(height: 8), Text('Watch and listen together, perfectly in sync.', style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
    const SizedBox(height: 44), SizedBox(width: double.infinity, height: 52, child: FilledButton.icon(onPressed: () => _create(context, ref), icon: const Icon(Icons.add_rounded), label: const Text('Create a room'))),
    const SizedBox(height: 12), SizedBox(width: double.infinity, height: 52, child: OutlinedButton.icon(onPressed: () => _join(context, ref), icon: const Icon(Icons.login_rounded), label: const Text('Join a room'))),
  ]))))));
}
