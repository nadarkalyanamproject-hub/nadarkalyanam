import 'package:flutter_test/flutter_test.dart';
import 'package:nadar_kalyanam/data/daily_picks.dart';
import 'package:nadar_kalyanam/data/members.dart';

void main() {
  final ids = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9', 'j10', 'k11', 'l12', 'm13', 'n14', 'o15'];
  final matches = [
    for (var i = 0; i < ids.length; i++)
      MemberCard(
        profileId: ids[i],
        fullName: ids[i],
        age: 28,
        relationship: i == 7 ? Relationship.sent : i == 2 ? Relationship.connected : Relationship.none,
      ),
  ];

  test('picks the same members as the website for the same member and day', () {
    // Expected values come from apps/web/lib/home-matches.ts with the same input.
    final r = splitHomeMatches(matches, userId: 'user-42', now: DateTime.utc(2026, 10, 25, 20));
    expect(r.recommended.map((m) => m.profileId), ['a1', 'b2', 'd4', 'e5', 'f6']);
    expect(r.daily.map((m) => m.profileId), ['o15', 'g7', 'i9', 'k11', 'm13', 'l12']);
  });

  test('the India date decides the day', () {
    // 20:00 UTC on the 25th is already the 26th in India.
    expect(istDateKey(DateTime.utc(2026, 10, 25, 20)), '2026-10-26');
    expect(istDateKey(DateTime.utc(2026, 10, 25, 18)), '2026-10-25');
  });
}
