# Nadar Kalyanam app (Android & iOS)

Flutter app for members, using the same API as the website (`apps/api`).
App ID: `com.nadarkalyanam.app` on both stores.

## What's in version 1 (pre-launch)

Before launch day matching is closed for everyone, so v1 covers what members
can do now:

- Boot animation, welcome screen
- Register (who the profile is for, name, mobile) and log in, with a one-time code
- DigiLocker identity check (when the API requires it)
- Onboarding: basic, personal & religious, location & career, family & about
  (with "Write it for me"), lifestyle & habits, then photos
- Home: when matching opens, the launch offer and its checklist, profile completion
- My profile: every section, edit any of them (pencil), photos (add, make main, remove, review status)
- Settings: show/hide profile, phone number sharing, signed-in devices and
  "Log out of all other devices", help & legal links, log out, delete account
- Members stay signed in until they log out (tokens in Keychain / Keystore)

Next (before launch day): matches, search, interests, chat, push
notifications, membership purchase.

## Run it locally

Start the API first (`docker compose up -d` and `pnpm dev` in the repo root).

```sh
cd apps/mobile
flutter pub get
flutter run                 # Android emulator: talks to the PC at 10.0.2.2:4000
flutter run -d chrome --web-port 3071   # quick look in the browser
```

Settings are build-time defines:

| Define | Default | Meaning |
|---|---|---|
| `API_BASE_URL` | `http://10.0.2.2:4000/api/v1` (Android), `http://localhost:4000/api/v1` (iOS / web) | The API |
| `WEB_BASE_URL` | `https://nadarkalyanam.com` | Website, for privacy policy and terms |

On a real phone use the PC's address, e.g.
`flutter run --dart-define=API_BASE_URL=http://192.168.0.103:4000/api/v1`.
Photo uploads go straight to storage through a signed URL that names the
storage host (`MINIO_ENDPOINT` in `apps/api/.env`), so for a real phone set
that to the PC's address too. Running in Chrome needs the page's origin in
the API's CORS list.

In development the code screen shows the code the API sent (`devOtp`); it is
never sent in production.

## Tests

```sh
flutter analyze
flutter test
```

## Releasing

Builds run on Codemagic (`/codemagic.yaml`), which also builds the iOS app on
its Macs, so no Mac is needed:

- `ios-testflight`: builds, signs and uploads to TestFlight.
- `android-release`: builds the signed app bundle (`.aab`) for Play Console.

Store checklist:

- Apple Developer Program and Google Play Console accounts (company accounts
  need a D-U-N-S number).
- Privacy policy and terms pages live on the website (`/privacy`, `/terms`).
- A review login for Apple and Google: a test number whose code they can
  enter (not built yet).
- In-app account deletion: built (Settings > Delete my account).
- Report and block: in the API; their screens arrive with matches and chat.
