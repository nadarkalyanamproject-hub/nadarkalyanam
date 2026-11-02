import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/logo.dart';

// The boot animation, as on the website (times in seconds):
//   0.0   pendant rises into place        2.3  KALYANAM letter by letter
//   1.6   NADAR letter by letter          3.0  a shine sweeps across the gold
//                                         3.6  TM fades in
// About 4.6s (tap to skip); with reduced motion, the still logo briefly.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

const _totalSeconds = 4.6;

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: Duration(milliseconds: (_totalSeconds * 1000).round()));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduce = MediaQuery.of(context).disableAnimations;
    if (reduce) {
      _c.value = 1;
      Future.delayed(const Duration(milliseconds: 900), _done);
    } else {
      _c.forward().whenComplete(_done);
    }
  }

  void _done() {
    if (mounted) ref.read(sessionProvider).finishSplash();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  // 0..1 progress between two moments of the timeline (in seconds), eased.
  double _t(double from, double to, [Curve curve = Curves.easeOutCubic]) =>
      curve.transform(((_c.value * _totalSeconds - from) / (to - from)).clamp(0.0, 1.0));

  // A word whose letters rise in one after another, from [start] seconds,
  // [step] apart. The leading space balances the one letterSpacing leaves
  // after the last letter, so the word stays centred.
  Widget _letters(String text, TextStyle style, double start, double step) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(width: style.letterSpacing ?? 0),
          for (var i = 0; i < text.length; i++)
            Builder(builder: (_) {
              final p = _t(start + i * step, start + i * step + 0.9);
              return Opacity(
                opacity: p,
                child: Transform.translate(offset: Offset(0, 14 * (1 - p)), child: Text(text[i], style: style)),
              );
            }),
        ],
      );

  @override
  Widget build(BuildContext context) {
    const size = 38.0;
    final nadar = GoogleFonts.cinzel(
      fontSize: size * LogoSizes.nadar,
      fontWeight: FontWeight.w700,
      letterSpacing: size * LogoSizes.nadar * LogoSizes.nadarTrack,
      height: 1.02,
      color: NK.maroon,
    );
    final kalyanam = GoogleFonts.cinzel(
      fontSize: size * LogoSizes.kalyanam,
      fontWeight: FontWeight.w600,
      letterSpacing: size * LogoSizes.kalyanam * LogoSizes.kalyanamTrack,
      height: 1.02,
      color: NK.goldText,
    );
    return Scaffold(
      backgroundColor: NK.ivory,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _done,
        child: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final rise = _t(0, 1.35);
              final shine = _t(3.0, 4.4, Curves.easeInOut);
              return Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Opacity(
                    opacity: rise,
                    child: Transform.translate(
                      offset: Offset(0, 18 * (1 - rise)),
                      child: Padding(
                        padding: const EdgeInsets.only(top: size * LogoSizes.markTop),
                        child: ShaderMask(
                          blendMode: BlendMode.srcATop,
                          shaderCallback: (rect) {
                            final x = -1.0 + 3.0 * shine; // sweeps left to right
                            return LinearGradient(
                              begin: Alignment(x - 0.4, -0.2),
                              end: Alignment(x + 0.4, 0.2),
                              colors: [Colors.transparent, const Color(0xBFFFF3CF), Colors.transparent],
                              stops: const [0.2, 0.5, 0.8],
                            ).createShader(rect);
                          },
                          child: const LogoMark(height: size * LogoSizes.markHeight),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: size * LogoSizes.gap),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      nadarWithTm(
                        nadar,
                        word: _letters('NADAR', nadar, 1.6, 0.12),
                        tmOpacity: _t(3.6, 4.2),
                      ),
                      _letters('KALYANAM', kalyanam, 2.3, 0.1),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
