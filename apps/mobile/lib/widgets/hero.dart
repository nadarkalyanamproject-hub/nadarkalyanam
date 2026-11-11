import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

// The deep maroon panel behind the Home and Me headers: a three-stop
// gradient with a faint gold kolam-style ring pattern in the top corner.
class HeroBackdrop extends StatelessWidget {
  const HeroBackdrop({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.radius = const BorderRadius.vertical(bottom: Radius.circular(34)),
    this.shadow = false,
  });
  final Widget child;
  final EdgeInsets padding;
  final BorderRadius radius;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: NK.heroGradient,
        borderRadius: radius,
        boxShadow: shadow ? NK.liftShadow : null,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            const Positioned(right: -70, top: -60, child: _Rings(size: 260)),
            const Positioned(left: -50, bottom: -80, child: _Rings(size: 170, opacity: 0.08)),
            Padding(padding: padding, child: child),
          ],
        ),
      ),
    );
  }
}

class _Rings extends StatelessWidget {
  const _Rings({required this.size, this.opacity = 0.14});
  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) =>
      IgnorePointer(child: CustomPaint(size: Size.square(size), painter: _RingsPainter(opacity)));
}

class _RingsPainter extends CustomPainter {
  _RingsPainter(this.opacity);
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2;
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = NK.goldLight.withValues(alpha: opacity);
    for (final f in [1.0, 0.8, 0.6]) {
      canvas.drawCircle(c, r * f, line);
    }
    // Petals between the outer two rings.
    const petals = 16;
    for (var i = 0; i < petals; i++) {
      final a = i * 2 * math.pi / petals;
      final p = c + Offset(math.cos(a), math.sin(a)) * r * 0.9;
      canvas.drawCircle(p, r * 0.07, line);
    }
    // Dots on the inner ring.
    final dot = Paint()..color = NK.goldLight.withValues(alpha: opacity * 1.4);
    for (var i = 0; i < 8; i++) {
      final a = i * 2 * math.pi / 8 + math.pi / 8;
      canvas.drawCircle(c + Offset(math.cos(a), math.sin(a)) * r * 0.6, 2, dot);
    }
  }

  @override
  bool shouldRepaint(_RingsPainter old) => old.opacity != opacity;
}
