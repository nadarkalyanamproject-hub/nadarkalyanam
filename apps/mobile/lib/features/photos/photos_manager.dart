import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/api.dart';
import '../../data/models.dart';
import '../../state/session.dart';
import '../../theme.dart';
import '../../widgets/form.dart';

// Add, review-status, make-main and remove photos. Every photo is checked
// by the team before other members see it.
class PhotosManager extends ConsumerStatefulWidget {
  const PhotosManager({super.key, this.onDone});
  // Shown as "Continue" (onboarding); null on the Photos page.
  final VoidCallback? onDone;

  @override
  ConsumerState<PhotosManager> createState() => _PhotosManagerState();
}

class _PhotosManagerState extends ConsumerState<PhotosManager> {
  bool _uploading = false;
  String? _error;

  Future<void> _add() async {
    final source = kIsWeb
        ? ImageSource.gallery
        : await showModalBottomSheet<ImageSource>(
            context: context,
            backgroundColor: Colors.white,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            builder: (context) => SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 8),
                  ListTile(
                    leading: const Icon(Icons.photo_camera_outlined, color: NK.maroon),
                    title: const Text('Take a photo'),
                    onTap: () => Navigator.pop(context, ImageSource.camera),
                  ),
                  ListTile(
                    leading: const Icon(Icons.photo_library_outlined, color: NK.maroon),
                    title: const Text('Choose from gallery'),
                    onTap: () => Navigator.pop(context, ImageSource.gallery),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          );
    if (source == null) return;
    final file = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 85);
    if (file == null) return;

    final name = file.name.toLowerCase();
    final type = file.mimeType ?? (name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    setState(() {
      _uploading = true;
      _error = null;
    });
    final session = ref.read(sessionProvider);
    try {
      await session.repo.uploadPhoto(await file.readAsBytes(), type);
      await session.refreshProfile();
      if (mounted) showSnack(context, 'Photo added. Our team will review it shortly.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _act(Photo photo) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            if (!photo.isPrimary)
              ListTile(
                leading: const Icon(Icons.star_outline_rounded, color: NK.maroon),
                title: const Text('Make main photo'),
                onTap: () => Navigator.pop(context, 'primary'),
              ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: NK.error),
              title: const Text('Remove photo', style: TextStyle(color: NK.error)),
              onTap: () => Navigator.pop(context, 'delete'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (action == null) return;
    final session = ref.read(sessionProvider);
    try {
      if (action == 'primary') await session.repo.setPrimaryPhoto(photo.id);
      if (action == 'delete') await session.repo.deletePhoto(photo.id);
      await session.refreshProfile();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final photos = ref.watch(sessionProvider).profile?.photos ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) ErrorBanner(_error!),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.78,
          children: [
            for (final p in photos) _PhotoTile(photo: p, onTap: () => _act(p)),
            _AddTile(uploading: _uploading, onTap: _uploading ? null : _add),
          ],
        ),
        const SizedBox(height: 16),
        const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.info_outline_rounded, size: 18, color: NK.gold),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Use clear, recent photos of the member only. Each photo is reviewed by our team before other members can see it.',
                style: TextStyle(fontSize: 13, height: 1.45, color: NK.muted),
              ),
            ),
          ],
        ),
        if (widget.onDone != null) ...[
          const SizedBox(height: 24),
          FilledButton(onPressed: widget.onDone, child: Text(photos.isEmpty ? 'Skip for now' : 'Continue')),
        ],
      ],
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({required this.photo, required this.onTap});
  final Photo photo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (photo.status) {
      'APPROVED' => ('Approved', NK.success),
      'REJECTED' => ('Not approved', NK.error),
      _ => ('In review', NK.goldText),
    };
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              photo.url,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(color: NK.cream, child: const Icon(Icons.broken_image_outlined, color: NK.subtle)),
            ),
            if (photo.isPrimary)
              Positioned(
                top: 6,
                left: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(color: NK.maroon, borderRadius: BorderRadius.circular(999)),
                  child: const Text('Main', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 5),
                color: Colors.white.withValues(alpha: 0.92),
                child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.uploading, required this.onTap});
  final bool uploading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: NK.cream,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: NK.gold, width: 1.2),
        ),
        child: Center(
          child: uploading
              ? const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4, color: NK.maroon))
              : const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add_a_photo_outlined, color: NK.maroon, size: 28),
                    SizedBox(height: 6),
                    Text('Add photo', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: NK.maroon)),
                  ],
                ),
        ),
      ),
    );
  }
}
