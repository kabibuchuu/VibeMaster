import 'package:flutter/material.dart';

void main() {
  runApp(const VibeMasterApp());
}

class VibeMasterApp extends StatelessWidget {
  const VibeMasterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VibeMaster',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7C3AED)),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.headphones_rounded, size: 72),
                  const SizedBox(height: 20),
                  Text('VibeMaster', style: Theme.of(context).textTheme.displaySmall),
                  const SizedBox(height: 8),
                  Text('Listen together. Stay in sync.', style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
                  const SizedBox(height: 40),
                  SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.add_rounded), label: const Text('Create room'))),
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.login_rounded), label: const Text('Join room'))),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
