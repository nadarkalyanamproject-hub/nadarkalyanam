import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme.dart';
import '../../widgets/logo.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NK.maroonDeep,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/images/hero.jpg', fit: BoxFit.cover, alignment: const Alignment(0.55, 0)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x33000000), Color(0x995C0C13), Color(0xF24A0A0F)],
                stops: [0, 0.45, 0.8],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Logo(size: 22, light: true),
                  const Spacer(),
                  Text('More than matches,\na stronger tomorrow', style: serif(38, color: Colors.white)),
                  const SizedBox(height: 12),
                  Text(
                    'Nadar Kalyanam brings together families with shared values, culture and traditions.',
                    style: TextStyle(fontSize: 15.5, height: 1.5, color: Colors.white.withValues(alpha: 0.85)),
                  ),
                  const SizedBox(height: 28),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: NK.goldLight, foregroundColor: NK.maroonDeep),
                    onPressed: () => context.push('/register'),
                    child: const Text('Create a free profile'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white70)),
                    onPressed: () => context.push('/login'),
                    child: const Text('I already have an account'),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: Text(
                      'Strictly for matrimonial purposes',
                      style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
