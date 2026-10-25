import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

// A labelled field: the label above, the control, then a hint or the error.
class FieldShell extends StatelessWidget {
  const FieldShell({super.key, required this.label, required this.child, this.error, this.hint, this.optional = false});
  final String label;
  final Widget child;
  final String? error;
  final String? hint;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              text: label,
              children: [if (optional) const TextSpan(text: '  (optional)', style: TextStyle(color: NK.subtle, fontWeight: FontWeight.w500))],
            ),
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: NK.ink),
          ),
          const SizedBox(height: 8),
          child,
          if (error != null || hint != null) ...[
            const SizedBox(height: 6),
            Text(
              error ?? hint!,
              style: TextStyle(fontSize: 12.5, color: error != null ? NK.error : NK.muted, fontWeight: error != null ? FontWeight.w600 : FontWeight.w400),
            ),
          ],
        ],
      ),
    );
  }
}

class NkTextField extends StatelessWidget {
  const NkTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hintText,
    this.error,
    this.hint,
    this.optional = false,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
    this.readOnly = false,
    this.onChanged,
    this.inputFormatters,
    this.prefix,
  });
  final String label;
  final TextEditingController controller;
  final String? hintText;
  final String? error;
  final String? hint;
  final bool optional;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;
  final bool readOnly;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;
  final Widget? prefix;

  @override
  Widget build(BuildContext context) {
    return FieldShell(
      label: label,
      error: error,
      hint: hint,
      optional: optional,
      child: TextField(
        controller: controller,
        readOnly: readOnly,
        keyboardType: keyboardType,
        maxLines: maxLines,
        maxLength: maxLength,
        onChanged: onChanged,
        inputFormatters: inputFormatters,
        textCapitalization: keyboardType == null ? TextCapitalization.sentences : TextCapitalization.none,
        decoration: InputDecoration(
          hintText: hintText,
          errorText: error == null ? null : '',
          errorStyle: const TextStyle(height: 0, fontSize: 0),
          counterText: '',
          prefixIcon: prefix,
          fillColor: readOnly ? NK.cream : Colors.white,
        ),
      ),
    );
  }
}

// A dropdown that opens a bottom sheet: easier to use with one thumb than a
// menu, and searchable for long lists (states, heights).
class NkPicker extends StatelessWidget {
  const NkPicker({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.error,
    this.hint,
    this.optional = false,
    this.enabled = true,
  });
  final String label;
  final String? value;
  // value -> label
  final Map<String, String> options;
  final ValueChanged<String?> onChanged;
  final String? error;
  final String? hint;
  final bool optional;
  final bool enabled;

  static Map<String, String> same(Iterable<String> values) => {for (final v in values) v: v};

  @override
  Widget build(BuildContext context) {
    final display = value == null ? null : options[value] ?? value;
    return FieldShell(
      label: label,
      error: error,
      hint: hint,
      optional: optional,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: enabled ? () => _open(context) : null,
        child: InputDecorator(
          isEmpty: display == null,
          decoration: InputDecoration(
            hintText: 'Select',
            errorText: error == null ? null : '',
            errorStyle: const TextStyle(height: 0, fontSize: 0),
            fillColor: enabled ? Colors.white : NK.cream,
            suffixIcon: const Icon(Icons.keyboard_arrow_down_rounded, color: NK.muted),
          ),
          child: display == null ? null : Text(display, style: const TextStyle(fontSize: 16, color: NK.ink)),
        ),
      ),
    );
  }

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _PickerSheet(title: label, options: options, selected: value, allowClear: optional),
    );
    if (picked == null) return;
    onChanged(picked.isEmpty ? null : picked);
  }
}

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({required this.title, required this.options, this.selected, this.allowClear = false});
  final String title;
  final Map<String, String> options;
  final String? selected;
  final bool allowClear;

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final entries = widget.options.entries.where((e) => e.value.toLowerCase().contains(query.toLowerCase())).toList();
    final searchable = widget.options.length > 12;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: NK.line, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
              child: Row(
                children: [
                  Expanded(child: Text(widget.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                  if (widget.allowClear && widget.selected != null)
                    TextButton(onPressed: () => Navigator.pop(context, ''), child: const Text('Clear')),
                ],
              ),
            ),
            if (searchable)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  autofocus: false,
                  onChanged: (v) => setState(() => query = v),
                  decoration: const InputDecoration(hintText: 'Search', prefixIcon: Icon(Icons.search_rounded)),
                ),
              ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: entries.length,
                itemBuilder: (_, i) {
                  final e = entries[i];
                  final selected = e.key == widget.selected;
                  return ListTile(
                    title: Text(e.value, style: TextStyle(fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
                    trailing: selected ? const Icon(Icons.check_rounded, color: NK.maroon) : null,
                    onTap: () => Navigator.pop(context, e.key),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// Tappable chips for a multi-choice (hobbies).
class ChoiceChips extends StatelessWidget {
  const ChoiceChips({super.key, required this.options, required this.selected, required this.onChanged, this.max});
  final List<String> options;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;
  final int? max;

  @override
  Widget build(BuildContext context) {
    final atLimit = max != null && selected.length >= max!;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in options)
          Builder(builder: (context) {
            final isOn = selected.contains(option);
            return FilterChip(
              label: Text(option),
              selected: isOn,
              showCheckmark: false,
              onSelected: !isOn && atLimit
                  ? null
                  : (on) => onChanged(on ? [...selected, option] : selected.where((s) => s != option).toList()),
              labelStyle: TextStyle(color: isOn ? Colors.white : NK.ink, fontWeight: FontWeight.w600, fontSize: 13.5),
              selectedColor: NK.maroon,
              backgroundColor: Colors.white,
              side: BorderSide(color: isOn ? NK.maroon : NK.line),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            );
          }),
      ],
    );
  }
}

// A filled button that shows a spinner while working.
class BusyButton extends StatelessWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.busy = false, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      child: busy
          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [Text(label), if (icon != null) ...[const SizedBox(width: 8), Icon(icon, size: 20)]],
            ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFFDECEC), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFF5C2C0))),
      child: Text(message, style: const TextStyle(color: NK.maroon, fontWeight: FontWeight.w600, fontSize: 13.5)),
    );
  }
}

// A white card with a soft gold border, the app's basic surface.
class NkCard extends StatelessWidget {
  const NkCard({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap});
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: NK.lineGold)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
