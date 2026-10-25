import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:nadar_kalyanam/data/members.dart';
import 'package:nadar_kalyanam/features/home/daily_deck.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  GoogleFonts.config.allowRuntimeFetching = false;

  final picks = [
    MemberCard(profileId: 'p1', fullName: 'Kavitha S', age: 29, city: 'Madurai'),
    MemberCard(profileId: 'p2', fullName: 'Priya R', age: 28, city: 'Chennai'),
  ];

  Future<void> pump(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(home: Scaffold(body: SingleChildScrollView(child: DailyDeck(picks: picks)))),
    ));
    await tester.pumpAndSettle();
  }

  testWidgets('swiping left skips to the next pick and is remembered for the day', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pump(tester);
    expect(find.text('Kavitha, 29'), findsOneWidget);
    expect(find.textContaining('1 of 2 today'), findsOneWidget);

    await tester.drag(find.text('Kavitha, 29'), const Offset(-300, 0));
    await tester.pumpAndSettle();
    expect(find.text('Kavitha, 29'), findsNothing);
    expect(find.textContaining('2 of 2 today'), findsOneWidget);

    await tester.tap(find.byTooltip('Skip'));
    await tester.pumpAndSettle();
    expect(find.text("You've seen today's picks"), findsOneWidget);

    // Reopening the app keeps today's swipes.
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getKeys().single.startsWith('nk.daily.'), isTrue);
    expect(prefs.getStringList(prefs.getKeys().single), containsAll(['p1', 'p2']));
  });

  testWidgets('a short drag springs back without deciding', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pump(tester);
    await tester.drag(find.text('Kavitha, 29'), const Offset(-40, 0));
    await tester.pumpAndSettle();
    expect(find.text('Kavitha, 29'), findsOneWidget);
    expect(find.textContaining('1 of 2 today'), findsOneWidget);
  });
}
