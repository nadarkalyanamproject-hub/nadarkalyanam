import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/deletion_pending_screen.dart';
import 'features/auth/identity_screen.dart';
import 'features/auth/otp_screen.dart';
import 'features/auth/phone_screen.dart';
import 'features/auth/welcome_screen.dart';
import 'features/home/home_screen.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/photos/photos_screen.dart';
import 'features/profile/edit_section_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/splash/splash_screen.dart';
import 'state/session.dart';
import 'theme.dart';

const _signedOutPaths = {'/welcome', '/register', '/login', '/otp'};

// The session decides the screen; the router only follows it.
GoRouter buildRouter(Session session) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: session,
    redirect: (context, state) {
      final path = state.matchedLocation;
      if (session.phase == Phase.booting || !session.splashDone) return path == '/splash' ? null : '/splash';
      switch (session.phase) {
        case Phase.signedOut:
          return _signedOutPaths.contains(path) ? null : '/welcome';
        case Phase.deletionPending:
          return path == '/deletion-pending' ? null : '/deletion-pending';
        case Phase.needsIdentity:
          return path == '/verify-identity' ? null : '/verify-identity';
        case Phase.needsProfile:
          return path == '/onboarding' ? null : '/onboarding';
        case Phase.ready:
          const entry = {'/splash', '/deletion-pending', '/verify-identity', '/onboarding', ..._signedOutPaths};
          return entry.contains(path) ? '/home' : null;
        case Phase.booting:
          return null;
      }
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/register', builder: (_, _) => const PhoneScreen(login: false)),
      GoRoute(path: '/login', builder: (_, _) => const PhoneScreen(login: true)),
      GoRoute(path: '/otp', builder: (_, state) => OtpScreen(args: state.extra! as OtpArgs)),
      GoRoute(path: '/verify-identity', builder: (_, _) => const IdentityScreen()),
      GoRoute(path: '/deletion-pending', builder: (_, _) => const DeletionPendingScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/photos', builder: (_, _) => const PhotosScreen()),
      GoRoute(path: '/profile/edit/:section', builder: (_, state) => EditSectionScreen(section: state.pathParameters['section']!)),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _Tabs(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen())]),
        ],
      ),
    ],
  );
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: NK.line))),
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded, color: NK.maroon), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded, color: NK.maroon), label: 'Profile'),
            NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings_rounded, color: NK.maroon), label: 'Settings'),
          ],
        ),
      ),
    );
  }
}
