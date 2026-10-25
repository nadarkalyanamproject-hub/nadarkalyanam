import 'package:flutter/material.dart';

import 'photos_manager.dart';

class PhotosScreen extends StatelessWidget {
  const PhotosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My photos')),
      body: const SafeArea(
        child: SingleChildScrollView(padding: EdgeInsets.fromLTRB(18, 20, 18, 32), child: PhotosManager()),
      ),
    );
  }
}
