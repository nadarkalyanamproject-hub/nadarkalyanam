import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/logo.dart';

// The boot animation, as on the website: the pendant rises, NADAR comes in
// letter by letter, KALYANAM spreads out and a shine crosses the gold.
// About 2.2s (tap to skip); with reduced motion, the still logo briefly.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200));
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

  // 0..1 progress of a sub-interval of the timeline, eased.
  double _t(double from, double to, [Curve curve = Curves.easeOutCubic]) =>
      curve.transform(((_c.value - from) / (to - from)).clamp(0.0, 1.0));

  @override
  Widget build(BuildContext context) {
    const size = 38.0;
    return Scaffold(
      backgroundColor: NK.ivory,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _done,
        child: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final rise = _t(0, 0.3);
              final shine = _t(0.55, 0.92, Curves.easeInOut);
              final spread = _t(0.48, 0.8);
              return Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Opacity(
                    opacity: rise,
                    child: Transform.translate(
                      offset: Offset(0, 18 * (1 - rise)),
                      child: Padding(
                        padding: const EdgeInsets.only(top: size * 0.0714),
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
                          child: const LogoMark(height: size * 1.434),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: size * 0.343),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          for (var i = 0; i < 5; i++)
                            Builder(builder: (_) {
                              final p = _t(0.36 + i * 0.025, 0.56 + i * 0.025);
                              return Opacity(
                                opacity: p,
                                child: Transform.translate(
                                  offset: Offset(0, 14 * (1 - p)),
                                  child: Text(
                                    'NADAR'[i],
                                    style: GoogleFonts.cinzel(
                                      fontSize: size,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: size * 0.1286,
                                      height: 1.02,
                                      color: NK.maroon,
                                    ),
                                  ),
                                ),
                              );
                            }),
                        ],
                      ),
                      Opacity(
                        opacity: spread,
                        child: Text(
                          'KALYANAM',
                          style: GoogleFonts.cinzel(
                            fontSize: size * 0.593,
                            fontWeight: FontWeight.w600,
                            letterSpacing: size * 0.593 * 0.2217 * spread,
                            height: 1.02,
                            color: NK.goldText,
                          ),
                        ),
                      ),
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
