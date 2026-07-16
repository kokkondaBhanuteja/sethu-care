# Building a test APK

The apps are managed Expo projects in a **pnpm monorepo** (`nodeLinker: hoisted`, the Expo-supported
setup). There is no local Android SDK checked in, so the reliable way to get an installable APK is an
**EAS cloud build** — it compiles on Expo's servers, no local Android SDK needed.

An `eas.json` `preview` profile is already committed for both apps (it builds an **APK**, not an AAB,
with internal distribution).

## Prerequisites (one time)

- A free Expo account: <https://expo.dev/signup>
- The EAS CLI: `npm install -g eas-cli` (or use `npx eas-cli@latest ...` in the commands below)

## Build the customer APK

```bash
cd mobile/apps/customer
eas login                       # sign in to your Expo account
eas init                        # links the app; writes extra.eas.projectId into app.json (commit it)
eas build --platform android --profile preview
```

EAS prints a build URL and, when finished (~10–20 min), a link to download/scan the **APK**. Install
it on any Android device (allow "install from unknown sources").

## Build the provider APK

```bash
cd mobile/apps/provider
eas init
eas build --platform android --profile preview
```

## Notes

- **Monorepo**: run `eas build` from the app directory. EAS uploads from the git root and installs the
  pnpm workspace; the hoisted node-linker is already configured, which is the key requirement.
- **`eas init`** adds `extra.eas.projectId` to that app's `app.json` — commit that change so future
  builds are reproducible.
- **iOS test build** (needs an Apple account for signing): `eas build --platform ios --profile preview`
  produces a simulator/ad-hoc build; or keep using `npx expo run:ios` for the local simulator.
- **Native modules already in these builds**: react-native-maps, expo-location, expo-haptics,
  expo-image, react-native-reanimated, lucide (svg). A fresh EAS build compiles all of them — no stale
  binary issues.

## Local alternative (heavier)

If you prefer building locally instead of the cloud: install the Android SDK (Android Studio or
`brew install --cask android-commandlinetools` + `sdkmanager` for platform-tools/build-tools/NDK, then
accept licenses and set `ANDROID_HOME`), then:

```bash
cd mobile/apps/customer
npx expo run:android --variant release   # emits app/build/outputs/apk/release/*.apk
```
