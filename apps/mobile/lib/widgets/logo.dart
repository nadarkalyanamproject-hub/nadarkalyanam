import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme.dart';

// The pendant mark, the same drawing as apps/web/components/brand/logo.tsx
// (source: Desktop/Tech Arnik/Nadar Kalyanam/logo/gen.mjs). viewBox 100x118.
String markSvg({String fill = 'url(#g)', bool withGradient = true}) => '''
<svg viewBox="0 10 100 118" xmlns="http://www.w3.org/2000/svg">
${withGradient ? '<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="20" y1="10" x2="80" y2="128"><stop offset="0" stop-color="#D9B45C"/><stop offset=".55" stop-color="#C89B3C"/><stop offset="1" stop-color="#B98B32"/></linearGradient></defs>' : ''}
<g fill="$fill">
<path fill-rule="evenodd" d="M6 128V32A22 22 0 0 1 50 32A22 22 0 0 1 94 32V128ZM13.5 82V33A14.5 14.5 0 0 1 42.5 33V82ZM57.5 82V33A14.5 14.5 0 0 1 86.5 33V82ZM14 90H43V128H14ZM57 90H86V128H57Z"/>
<polyline points="14,90 28.5,118 43,90" fill="none" stroke="$fill" stroke-width="6.5"/>
<polyline points="57,90 71.5,118 86,90" fill="none" stroke="$fill" stroke-width="6.5"/>
<g fill="none" stroke="$fill" stroke-width="1.3"><path d="M16.3 79.2V33A11.7 11.7 0 0 1 39.7 33V79.2Z"/><path d="M60.3 79.2V33A11.7 11.7 0 0 1 83.7 33V79.2Z"/></g>
<g transform="translate(28 77.4) scale(1.12) translate(-28 -77.4)">
<path d="M18.8 63H37.2V66.2L34.2 69V70.4L37.2 73.4V77.4H18.8V73.4L21.8 70.4V69L18.8 66.2Z"/>
<path d="M22.8 63V53.2A5.2 5.2 0 0 1 33.2 53.2V63Z"/>
<path d="M20.4 61V52.6A7.6 7.6 0 0 1 35.6 52.6V61" fill="none" stroke="$fill" stroke-width="1.5"/>
<circle cx="20.4" cy="61" r="1.5"/><circle cx="35.6" cy="61" r="1.5"/><circle cx="28" cy="43.4" r="1.5"/>
</g>
<g transform="translate(72 77.4) scale(1.1) translate(-72 -77.4)">
<path d="M69.2 41.2L69.8 38.4H70.7L71.3 35.2H72.7L73.3 38.4H74.2L74.8 41.2Z"/>
<circle cx="72" cy="43" r="2.8"/>
<path d="M67.4 48Q72 46 76.6 48L75.3 58.4L77.9 74.4H66.1L68.7 58.4Z"/>
<g fill="none" stroke="$fill" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M67.7 49.2L66.2 57.4"/><path d="M76.3 49.2L78.5 55L78.7 51"/></g>
<rect x="64.8" y="74.6" width="14.4" height="2.8"/>
</g>
</g>
</svg>''';

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.height = 48, this.color});
  final double height;
  // A flat colour instead of the gold gradient (e.g. the splash shine).
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final svg = color == null
        ? markSvg()
        : markSvg(fill: '#${color!.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}', withGradient: false);
    return SvgPicture.string(svg, height: height);
  }
}

// Pendant beside NADAR over KALYANAM, in the website's proportions:
// everything scales from the NADAR size.
class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 22, this.light = false});
  final double size;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final a = GoogleFonts.cinzel(
      fontSize: size,
      fontWeight: FontWeight.w700,
      letterSpacing: size * 0.1286,
      height: 1.02,
      color: light ? Colors.white : NK.maroon,
    );
    final b = GoogleFonts.cinzel(
      fontSize: size * 0.593,
      fontWeight: FontWeight.w600,
      letterSpacing: size * 0.593 * 0.2217,
      height: 1.02,
      color: light ? NK.goldLight : NK.goldText,
    );
    return Semantics(
      label: 'Nadar Kalyanam',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: EdgeInsets.only(top: size * 0.0714), child: LogoMark(height: size * 1.434)),
            SizedBox(width: size * 0.343),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [Text('NADAR', style: a), Text('KALYANAM', style: b)],
            ),
          ],
        ),
      ),
    );
  }
}
