import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// The same nk-* palette as the website (apps/web/app/globals.css).
class NK {
  static const maroon = Color(0xFF7A1118);
  static const maroonDeep = Color(0xFF5C0C13);
  static const maroonBright = Color(0xFF8E1B24);
  static const gold = Color(0xFFC89B3C);
  static const goldLight = Color(0xFFE9C77A);
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
}

// Headings use the landing page's serif; body text Plus Jakarta Sans; the
// wordmark Cinzel (see widgets/logo.dart).
TextStyle serif(double size, {Color color = NK.ink, FontWeight weight = FontWeight.w700}) =>
    GoogleFonts.cormorantGaramond(fontSize: size, fontWeight: weight, color: color, height: 1.15);

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
  final radius = BorderRadius.circular(14);
  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: NK.butter,
      foregroundColor: NK.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.plusJakartaSans(fontSize: 17, fontWeight: FontWeight.w700, color: NK.ink),
      shape: const Border(bottom: BorderSide(color: Color(0x66E9B53F))),
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
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NK.maroon,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: NK.maroon),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: NK.maroon,
        textStyle: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: NK.ink),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: NK.butter,
      labelTextStyle: WidgetStatePropertyAll(GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600)),
    ),
    dividerTheme: const DividerThemeData(color: NK.line, space: 1, thickness: 1),
  );
}
