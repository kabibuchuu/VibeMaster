import 'package:flutter/material.dart';
import 'features/home/home_page.dart';

class VibeMasterApp extends StatelessWidget {
  const VibeMasterApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'VibeMaster',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7C3AED)), inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder())),
    home: const HomePage(),
  );
}
