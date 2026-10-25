import 'members.dart';

// "Daily recommendations", the same picks as the website's home page
// (apps/web/lib/daily-picks.ts and home-matches.ts): a few members chosen
// from the member's own matches, the same all day and new the next day
// (India time), identical on every device.

const _mask = 0xFFFFFFFF;

// Math.imul: the low 32 bits of the product.
int _imul(int a, int b) => (a * b) & _mask;

/// The India-time calendar date, e.g. "2026-10-09".
String istDateKey([DateTime? now]) =>
    (now ?? DateTime.now()).toUtc().add(const Duration(hours: 5, minutes: 30)).toIso8601String().substring(0, 10);

// FNV-1a over UTF-16 code units, as the web.
int _hashSeed(String seed) {
  var hash = 0x811c9dc5;
  for (final unit in seed.codeUnits) {
    hash = _imul(hash ^ unit, 0x01000193);
  }
  return hash;
}

// mulberry32 finaliser: a 32-bit seed spread over [0, 1).
double _seededRandom(int seed) {
  var t = (seed + 0x6d2b79f5) & _mask;
  t = _imul(t ^ (t >> 15), 1 | t);
  t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _mask) ^ t;
  return ((t ^ (t >> 14)) & _mask) / 4294967296;
}

/// Splits ranked matches into the top `recommendedCount` ("Recommended for
/// you") and today's picks: members with no interest either way, not
/// already recommended, shuffled by member + India date.
({List<MemberCard> recommended, List<MemberCard> daily}) splitHomeMatches(
  List<MemberCard> matches, {
  required String userId,
  int recommendedCount = 5,
  int dailyCount = 6,
  DateTime? now,
}) {
  final candidates = matches.where((m) => m.relationship != Relationship.connected).toList();
  final recommended = candidates.take(recommendedCount).toList();
  final taken = recommended.map((m) => m.profileId).toSet();
  final seed = '$userId:${istDateKey(now)}';
  final pool = candidates.where((m) => m.relationship == Relationship.none && !taken.contains(m.profileId)).toList();
  final keyed = [for (final m in pool) (m, _seededRandom(_hashSeed('$seed:${m.profileId}')))]..sort((a, b) => a.$2.compareTo(b.$2));
  return (recommended: recommended, daily: keyed.take(dailyCount).map((e) => e.$1).toList());
}
