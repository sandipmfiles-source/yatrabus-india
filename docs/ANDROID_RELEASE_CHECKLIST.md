# YatraBus India — Android release checklist

This guide covers the signed Android release workflow. A successful debug APK is not a Play Store release.

## Current Android identity

- Application ID: `in.yatribus.app`
- Current version name/code: `1.0.1` / `2`
- Debug application ID gets the `.debug` suffix and can coexist with the release app.
- The signed workflow builds both a release APK and an Android App Bundle (AAB).

## One-time signing setup

1. Generate a dedicated upload/release keystore on a trusted computer. Keep the keystore and its passwords in a secure offline backup. Loss of the key can prevent updates to the existing Play listing.
2. Record the key alias and certificate fingerprint in a secure password manager.
3. Base64-encode the keystore file locally. Never paste the keystore or passwords into an issue, pull request, chat, or repository file.
4. In GitHub repository Settings → Secrets and variables → Actions, create these repository secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`
5. Add repository Actions variables:
   - `VITE_API_BASE_URL`: the deployed production HTTPS API base URL, including `/api`.
   - `VITE_PUBLIC_APP_URL`: the public HTTPS app URL.
6. Do not use a placeholder URL. The signed release workflow deliberately stops until both HTTPS variables and all four secrets are configured.

## Build a signed candidate

1. Open GitHub Actions → **Build Signed Android Release**.
2. Select **Run workflow** on the reviewed release branch/commit.
3. Wait for dependency audit, TypeScript/Vite build, tests, Capacitor sync, Gradle APK/AAB build and signature checks.
4. Download the `yatribus-signed-release-*` artifact. It contains the APK, AAB and SHA-256 checksum file.
5. Verify the downloaded files against the checksum file before distribution.

The workflow publishes a GitHub pre-release candidate, not a production Play Store release.

## Release acceptance tests

- Install the APK on a clean Android device and verify the package ID and version.
- Upgrade-install over the previous release and confirm user data/settings behave as expected.
- Test startup, permission denial/grant, location consent/revocation, app background/foreground, Android Back navigation and network loss.
- Verify API connectivity against the configured HTTPS backend. A successful APK build alone does not prove that the backend is deployed or contains verified bus schedules.
- Confirm the signing certificate fingerprint matches the preserved release key.
- Review Play Console policy, target API requirements, store listing, privacy policy, data safety declarations and required testing track before any public release.

## Important safety rules

- Never commit a keystore, decoded keystore, passwords, signing properties, or generated credentials.
- Never distribute a debug APK as the production release.
- Increase `versionCode` for every Play Store upload; keep it greater than every previously uploaded version.
- Keep at least two secure backups of the original keystore and document who controls them.
- Do not call a release production-ready until the live backend, bus data, privacy disclosures and real-device tests have passed.
