import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'router.dart';
import 'state/session.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: NadarKalyanamApp()));
}

class NadarKalyanamApp extends ConsumerStatefulWidget {
  const NadarKalyanamApp({super.key});

  @override
  ConsumerState<NadarKalyanamApp> createState() => _NadarKalyanamAppState();
}

class _NadarKalyanamAppState extends ConsumerState<NadarKalyanamApp> {
  late final GoRouter _router = buildRouter(ref.read(sessionProvider));

  @override
  void initState() {
    super.initState();
    ref.read(sessionProvider).boot();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Nadar Kalyanam',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: _router,
    );
  }
}
