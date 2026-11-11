import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// The same nk-* palette as the website (apps/web/app/globals.css).
class NK {
  static const maroon = Color(0xFF7A1118);
  static const maroonDeep = Color(0xFF5C0C13);
  static const maroonNight = Color(0xFF3D070C);
  static const maroonBright = Color(0xFF8E1B24);
  static const gold = Color(0xFFC89B3C);
  static const goldLight = Color(0xFFE9C77A);
  static const goldPale = Color(0xFFF6E7C1);
  static const goldText = Color(0xFF8A6420);
  static const ink = Color(0xFF2B1B14);
  static const muted = Color(0xFF6B5A50);
  static const subtle = Color(0xFF8A796E);
  static const ivory = Color(0xFFFFFDF9);
  static const cream = Color(0xFFFFFBF2);
  static const butter = Color(0xFFFFF7DC);
  static const line = Color(0xFFEADFCF);
  static const lineGold = Color(0x59C89B3C);
  static const success = Color(0xFF1F7A4D);
  static const error = Color(0xFFB3261E);

  // Shared decoration pieces, so every surface reads as one family.
  static const heroGradient = LinearGradient(
    colors: [maroonBright, maroonDeep, maroonNight],
    stops: [0, 0.6, 1],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const goldGradient = LinearGradient(colors: [goldLight, gold], begin: Alignment.topLeft, end: Alignment.bottomRight);
  static const softShadow = [BoxShadow(color: Color(0x142B1B14), blurRadius: 24, offset: Offset(0, 8))];
  static const liftShadow = [BoxShadow(color: Color(0x262B1B14), blurRadius: 28, offset: Offset(0, 12))];
}

// Headings use the landing page's serif; body text Plus Jakarta Sans; the
// wordmark Cinzel (see widgets/logo.dart).
TextStyle serif(double size, {Color color = NK.ink, FontWeight weight = FontWeight.w700}) =>
    GoogleFonts.cormorantGaramond(fontSize: size, fontWeight: weight, color: color, height: 1.15);

// Small spaced capitals above a heading.
TextStyle eyebrow({Color color = NK.goldText}) =>
    GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.6, color: color);

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: NK.maroon,
      primary: NK.maroon,
      secondary: NK.gold,
      surface: Colors.white,
      error: NK.error,
    ),
    scaffoldBackgroundColor: NK.ivory,
  );
  final text = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(bodyColor: NK.ink, displayColor: NK.ink);
  final radius = BorderRadius.circular(16);
  return base.copyWith(
    textTheme: text,
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
    appBarTheme: AppBarTheme(
      backgroundColor: NK.ivory,
      foregroundColor: NK.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.6,
      shadowColor: const Color(0x332B1B14),
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      titleTextStyle: GoogleFonts.cormorantGaramond(fontSize: 26, fontWeight: FontWeight.w700, color: NK.ink, height: 1.1),
      iconTheme: const IconThemeData(color: NK.ink),
      actionsIconTheme: const IconThemeData(color: NK.ink),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: NK.maroon,
      unselectedLabelColor: NK.muted,
      indicatorColor: NK.gold,
      indicatorSize: TabBarIndicatorSize.label,
      dividerColor: NK.line,
      labelStyle: GoogleFonts.plusJakartaSans(fontSize: 14.5, fontWeight: FontWeight.w700),
      unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontSize: 14.5, fontWeight: FontWeight.w600),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: const TextStyle(color: NK.subtle),
      border: OutlineInputBorder(borderRadius: radius, borderSide: const BorderSide(color: NK.line)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: const BorderSide(color: NK.line)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: const BorderSide(color: NK.gold, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: radius, borderSide: const BorderSide(color: NK.error)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: radius, borderSide: const BorderSide(color: NK.error, width: 1.5)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NK.maroon,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.2),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NK.maroon,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: NK.maroon, width: 1.2),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.2),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: NK.maroon,
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      side: const BorderSide(color: NK.line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w600, color: NK.ink),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : null),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? NK.maroon : null),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: NK.ivory,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: NK.ivory,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      titleTextStyle: GoogleFonts.cormorantGaramond(fontSize: 24, fontWeight: FontWeight.w700, color: NK.ink),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    listTileTheme: const ListTileThemeData(iconColor: NK.maroon),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: NK.maroon),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: NK.ink,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    dividerTheme: const DividerThemeData(color: NK.line, space: 1, thickness: 1),
  );
}
