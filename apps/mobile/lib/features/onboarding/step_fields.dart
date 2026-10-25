import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/reference.dart';
import '../../theme.dart';
import '../../widgets/form.dart';
import 'profile_form.dart';

// The fields of each step, shared by onboarding and "Edit" on My Profile.
// Each writes straight into the ProfileForm and calls onChanged.

typedef Errors = Map<String, String>;

class _Text extends StatefulWidget {
  const _Text({
    required this.label,
    required this.initial,
    required this.onChanged,
    this.error,
    this.hint,
    this.hintText,
    this.optional = false,
    this.maxLines = 1,
    this.keyboardType,
    this.readOnly = false,
  });
  final String label;
  final String initial;
  final ValueChanged<String> onChanged;
  final String? error;
  final String? hint;
  final String? hintText;
  final bool optional;
  final int maxLines;
  final TextInputType? keyboardType;
  final bool readOnly;

  @override
  State<_Text> createState() => _TextState();
}

class _TextState extends State<_Text> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);

  @override
  void didUpdateWidget(covariant _Text old) {
    super.didUpdateWidget(old);
    // Set from outside (e.g. "Write it for me").
    if (widget.initial != _c.text && widget.initial != old.initial) _c.text = widget.initial;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => NkTextField(
        label: widget.label,
        controller: _c,
        error: widget.error,
        hint: widget.hint,
        hintText: widget.hintText,
        optional: widget.optional,
        maxLines: widget.maxLines,
        keyboardType: widget.keyboardType,
        readOnly: widget.readOnly,
        onChanged: widget.onChanged,
      );
}

class BasicFields extends StatelessWidget {
  const BasicFields({super.key, required this.form, required this.errors, required this.onChanged, this.identityLocked = false});
  final ProfileForm form;
  final Errors errors;
  final VoidCallback onChanged;
  // After DigiLocker the name and date of birth come from the ID.
  final bool identityLocked;

  Future<void> _pickDob(BuildContext context) async {
    final now = DateTime.now();
    final latest = DateTime(now.year - 18, now.month, now.day);
    final current = DateTime.tryParse(form.dateOfBirth);
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime(now.year - 25, 1, 1),
      firstDate: DateTime(now.year - 100),
      lastDate: latest,
      initialDatePickerMode: DatePickerMode.year,
      helpText: 'Date of birth',
    );
    if (picked == null) return;
    form.dateOfBirth = DateFormat('yyyy-MM-dd').format(picked);
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final lockedHint = identityLocked ? 'From DigiLocker' : null;
    final dob = DateTime.tryParse(form.dateOfBirth);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Text(
          label: form.label('Full name'),
          initial: form.fullName,
          readOnly: identityLocked,
          hint: lockedHint,
          error: errors['fullName'],
          onChanged: (v) {
            form.fullName = v;
            onChanged();
          },
        ),
        NkPicker(
          label: form.label('Gender'),
          value: form.gender.isEmpty ? null : form.gender,
          options: genders,
          error: errors['gender'],
          onChanged: (v) {
            form.gender = v ?? '';
            onChanged();
          },
        ),
        FieldShell(
          label: form.label('Date of birth'),
          error: errors['dateOfBirth'],
          hint: lockedHint,
          child: InkWell(
            onTap: identityLocked ? null : () => _pickDob(context),
            borderRadius: BorderRadius.circular(14),
            child: InputDecorator(
              isEmpty: dob == null,
              decoration: InputDecoration(
                hintText: 'Select date',
                fillColor: identityLocked ? NK.cream : Colors.white,
                errorText: errors['dateOfBirth'] == null ? null : '',
                errorStyle: const TextStyle(height: 0, fontSize: 0),
                suffixIcon: const Icon(Icons.calendar_today_outlined, size: 20, color: NK.muted),
              ),
              child: dob == null ? null : Text(DateFormat('dd-MM-yyyy').format(dob), style: const TextStyle(fontSize: 16)),
            ),
          ),
        ),
        NkPicker(
          label: form.label('Religion'),
          value: form.religion.isEmpty ? null : form.religion,
          options: NkPicker.same(religions),
          error: errors['religion'],
          onChanged: (v) {
            form.religion = v ?? '';
            onChanged();
          },
        ),
        NkPicker(
          label: form.label('Nadar subcategory'),
          value: form.casteCommunity.isEmpty ? null : form.casteCommunity,
          options: NkPicker.same(nadarSubcategories),
          error: errors['casteCommunity'],
          onChanged: (v) {
            form.casteCommunity = v ?? '';
            onChanged();
          },
        ),
        _Text(
          label: 'Email',
          initial: form.email,
          hintText: 'name@example.com',
          keyboardType: TextInputType.emailAddress,
          hint: 'Never shown to other members.',
          error: errors['email'],
          onChanged: (v) {
            form.email = v;
            onChanged();
          },
        ),
      ],
    );
  }
}

class PersonalFields extends StatelessWidget {
  const PersonalFields({super.key, required this.form, required this.errors, required this.onChanged});
  final ProfileForm form;
  final Errors errors;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final priorMarriage = priorMarriageStatuses.contains(form.maritalStatus);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NkPicker(
          label: form.label('Height'),
          value: form.height.isEmpty ? null : form.height,
          options: NkPicker.same(heights),
          error: errors['height'],
          onChanged: (v) {
            form.height = v ?? '';
            onChanged();
          },
        ),
        NkPicker(
          label: form.label('Physical status'),
          value: form.physicalStatus,
          options: physicalStatuses,
          onChanged: (v) {
            form.physicalStatus = v ?? 'NORMAL';
            onChanged();
          },
        ),
        NkPicker(
          label: form.label('Marital status'),
          value: form.maritalStatus.isEmpty ? null : form.maritalStatus,
          options: maritalStatuses,
          error: errors['maritalStatus'],
          onChanged: (v) {
            form.maritalStatus = v ?? '';
            if (!priorMarriageStatuses.contains(form.maritalStatus)) form.previousMarriageDetails = '';
            onChanged();
          },
        ),
        if (priorMarriage)
          _Text(
            label: form.label('Previous marriage details'),
            initial: form.previousMarriageDetails,
            optional: true,
            maxLines: 3,
            error: errors['previousMarriageDetails'],
            onChanged: (v) {
              form.previousMarriageDetails = v;
              onChanged();
            },
          ),
        NkPicker(
          label: form.label('Complexion'),
          optional: true,
          value: form.complexion.isEmpty ? null : form.complexion,
          options: NkPicker.same(complexions),
          onChanged: (v) {
            form.complexion = v ?? '';
            onChanged();
          },
        ),
        NkPicker(
          label: form.label('Dosham'),
          optional: true,
          value: form.dosham.isEmpty ? null : form.dosham,
          options: doshamOptions,
          onChanged: (v) {
            form.dosham = v ?? '';
            if (form.dosham != 'YES') form.doshamDetails = '';
            onChanged();
          },
        ),
        if (form.dosham == 'YES')
          NkPicker(
            label: form.label('Dosham details'),
            optional: true,
            value: form.doshamDetails.isEmpty ? null : form.doshamDetails,
            options: NkPicker.same({...doshamTypes, if (form.doshamDetails.isNotEmpty) form.doshamDetails}),
            onChanged: (v) {
              form.doshamDetails = v ?? '';
              onChanged();
            },
          ),
      ],
    );
  }
}

class LocationFields extends StatelessWidget {
  const LocationFields({super.key, required this.form, required this.errors, required this.onChanged});
  final ProfileForm form;
  final Errors errors;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NkPicker(
          label: form.label('State'),
          value: form.state.isEmpty ? null : form.state,
          options: NkPicker.same(indiaStates),
          error: errors['state'],
          onChanged: (v) {
            form.state = v ?? '';
            onChanged();
          },
        ),
        _Text(label: form.label('City'), initial: form.city, hintText: 'e.g. Madurai', error: errors['city'], onChanged: (v) {
            form.city = v;
            onChanged();
          }),
        _Text(
          label: form.label('Education'),
          initial: form.educationLevel,
          hintText: 'e.g. Bachelors',
          error: errors['educationLevel'],
          onChanged: (v) {
            form.educationLevel = v;
            onChanged();
          },
        ),
        _Text(
          label: form.label('Education detail'),
          initial: form.educationDetail,
          optional: true,
          hintText: 'e.g. B.Tech Computer Science',
          onChanged: (v) {
            form.educationDetail = v;
            onChanged();
          },
        ),
        _Text(
          label: form.label('Occupation'),
          initial: form.profession,
          hintText: 'e.g. Software Engineer',
          error: errors['profession'],
          onChanged: (v) {
            form.profession = v;
            onChanged();
          },
        ),
        _Text(
          label: form.label('Employment type'),
          initial: form.employedIn,
          optional: true,
          hintText: 'e.g. Private, Government',
          onChanged: (v) {
            form.employedIn = v;
            onChanged();
          },
        ),
        _Text(
          label: form.label('Annual income'),
          initial: form.annualIncomeRange,
          optional: true,
          hintText: 'e.g. 10-15 LPA',
          hint: 'In Indian Rupees.',
          onChanged: (v) {
            form.annualIncomeRange = v;
            onChanged();
          },
        ),
      ],
    );
  }
}

class AdditionalFields extends StatelessWidget {
  const AdditionalFields({super.key, required this.form, required this.errors, required this.onChanged});
  final ProfileForm form;
  final Errors errors;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NkPicker(
          label: 'Family status',
          value: form.familyType.isEmpty ? null : form.familyType,
          options: NkPicker.same(familyStatuses),
          error: errors['familyType'],
          onChanged: (v) {
            form.familyType = v ?? '';
            onChanged();
          },
        ),
        if (form.familyType == netWorthFamilyStatus)
          NkPicker(
            label: 'Family net worth',
            optional: true,
            value: form.netWorth.isEmpty ? null : form.netWorth,
            options: NkPicker.same(netWorthRanges),
            onChanged: (v) {
              form.netWorth = v ?? '';
              onChanged();
            },
          ),
        _Text(
          label: aboutLabel(form.profileFor),
          initial: form.about,
          maxLines: 6,
          hint: 'At least 50 characters. You can edit anything written for you.',
          error: errors['about'],
          onChanged: (v) {
            form.about = v;
            onChanged();
          },
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () {
              form.about = form.aboutDraft();
              onChanged();
            },
            icon: const Icon(Icons.auto_awesome_outlined, size: 18),
            label: Text(form.about.trim().isEmpty ? 'Write it for me' : 'Write it again for me'),
          ),
        ),
      ],
    );
  }
}

class LifestyleFields extends StatelessWidget {
  const LifestyleFields({super.key, required this.form, required this.onChanged});
  final ProfileForm form;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l = form.lifestyle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NkPicker(label: form.label('Diet'), optional: true, value: l.diet, options: NkPicker.same(diets), onChanged: (v) {
            l.diet = v;
            onChanged();
          }),
        NkPicker(
          label: form.label('Smoking'),
          optional: true,
          value: l.smoking,
          options: NkPicker.same(habitFrequencies),
          onChanged: (v) {
            l.smoking = v;
            onChanged();
          },
        ),
        NkPicker(
          label: form.label('Drinking'),
          optional: true,
          value: l.drinking,
          options: NkPicker.same(habitFrequencies),
          onChanged: (v) {
            l.drinking = v;
            onChanged();
          },
        ),
        FieldShell(
          label: form.label('Hobbies & interests'),
          optional: true,
          hint: 'Pick up to $maxHobbies.',
          child: ChoiceChips(options: hobbies, selected: l.hobbies, max: maxHobbies, onChanged: (v) {
            l.hobbies = v;
            onChanged();
          }),
        ),
      ],
    );
  }
}
