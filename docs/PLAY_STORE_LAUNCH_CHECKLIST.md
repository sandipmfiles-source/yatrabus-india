# YatriBus India — Google Play Store launch gate

**Status: PREPARATION ONLY — NOT APPROVED FOR PRODUCTION SUBMISSION**

This checklist is written for the current Android app in this repository. It does not claim that Google Play has reviewed or approved the app.

## 1. App identity

| Field | Proposed value |
|---|---|
| App name | YatriBus India |
| Android application ID | `in.yatribus.app` |
| Current version name | `1.0.1` |
| Current version code | `2` |
| Minimum Android API | `24` |
| Compile / target API | `36` |
| Default language | English |
| Additional app languages | Hindi and Bengali |

The current target API 36 meets the Google Play requirement for new app submissions from 31 August 2026. Recheck the official requirement immediately before upload: https://developer.android.com/google/play/requirements/target-sdk

## 2. Draft store listing copy

### App title
YatriBus India

### Short description (draft)
Find bus routes, stops and available timetables across India.

### Full description (draft — publish only after backend/data verification)
YatriBus India helps passengers discover bus routes, stops and available timetable information.

FEATURES
- Search journeys by origin and destination.
- Explore available routes, stops and timetable information.
- Browse an India-focused directory of administrative places and transport information.
- Use English, Hindi and Bengali.
- View route maps where route geometry is available.
- Submit corrections or missing bus and stop information without creating a passenger account.
- Choose whether to share location during a journey to help show a bus-level position to other commuters.

LOCATION AND LIVE SHARING
Location is optional for ordinary route search and browsing. If you choose a location-based feature, Android may ask for location permission. Bus journey sharing is a separate opt-in: while a shared journey is active, location may be collected in the background or when the app is not in use to show a bus-level position. You can decline or stop sharing at any time; sessions expire automatically.

DATA ACCURACY
Availability and coverage depend on the transport data currently supplied and verified for each area. The app does not claim that every Indian bus, stop or timetable is present or independently verified. Timetable estimates and consent-based location observations are distinct.

YatriBus is a community-powered public transport information project. It is not an official government transport app and is not affiliated with state transport undertakings unless a specific partnership is separately confirmed.

**Do not publish this description unchanged until the live API, route coverage, location disclosure and every described feature have been tested in the release build.** Remove any feature claim that is not actually available in the submitted version.

## 3. Privacy policy and public URL

- In-app privacy route: `/privacy`.
- Candidate website URL for Play Console: `https://yatrabus-india.pages.dev/privacy`.
- The URL was not verified as reachable during preparation. Open it in a normal browser, without signing in, and confirm that it loads over HTTPS before entering it in Play Console.
- The policy currently has no verified developer contact email. Add an email address that the developer controls and monitors to the website policy and Play Console developer contact details before submission.
- Ensure the website policy identifies the same app/developer identity used in Play Console, is readable without login, and describes actual collection, processing, sharing, retention and deletion practices.
- Reconcile the final policy with production server logs, hosting provider logs, map/tile providers, QR image service and any speech-recognition service. Do not declare “no data collected” without a full SDK/network audit.

## 4. Sensitive location permission — critical review item

The Android manifest includes:
- `ACCESS_COARSE_LOCATION`
- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS`

The app has a separate journey-sharing consent dialog. Its English, Hindi and Bengali text has been updated to explicitly explain that location may be collected in the background or when the app is not in use, for the purpose of showing a bus-level journey position.

Google Play may require a Location permissions declaration, a demonstration video, prominent in-app disclosure before the runtime permission, and a privacy policy linked both in-app and in the listing. The feature must provide significant user benefit and be part of the app's core functionality.

Official guidance: https://support.google.com/googleplay/android-developer/answer/9799150

Before submission:
1. Record a short real-device video (Google recommends 30 seconds or less) showing the user starting journey sharing, the prominent disclosure, Android permission prompt, visible tracking notification, and stopping sharing.
2. In Play Console → App content → Sensitive app permissions → Location permissions, explain one specific background-location feature and why background access is essential.
3. If background location is not essential to the released app or cannot be demonstrated reliably, remove `ACCESS_BACKGROUND_LOCATION` and all associated background-location behavior from the submitted build instead of declaring an unsupported use.
4. Test permission denial, approximate-only location, revoke, stop sharing, app background/closed, force-stop, battery saver and session expiry.

## 5. Data safety and app content declarations

Complete these in Play Console only after auditing the exact release build and production infrastructure:
- Data Safety: location, diagnostics, app interactions, user-generated content and any other data actually collected or shared. Determine whether each is collected, ephemeral, optional, encrypted in transit and whether users can request deletion.
- App access: provide reviewer access instructions if any feature is restricted. Do not provide production admin credentials.
- Ads: declare accurately. Do not state “no ads” unless verified in the submitted build and all SDKs.
- Content rating questionnaire.
- Target audience and age group.
- Government affiliation: do not imply official government status or endorsement.
- Permissions declarations for location and any other sensitive permissions.
- Developer contact email and website.
- Privacy policy URL.

Do not guess answers in Data Safety. Review the final APK/AAB manifest and network/SDK behavior before submitting.

## 6. Graphics and listing assets

Prepare original assets from the actual release UI; do not use fabricated app screenshots.

- App icon: 512 × 512 px PNG, under 1 MB, 32-bit with alpha.
- Feature graphic: 1024 × 500 px JPEG or 24-bit PNG without alpha.
- Phone screenshots: capture real app screens from the release build; ensure text is readable and no debug/test data or private information appears.
- Short description: within Play Console's current character limit.
- Full description: factual, with no unsupported nationwide coverage, official affiliation or live-tracking claims.
- Localized English, Hindi and Bengali listing text should match the shipped app translations.

Official asset guidance: https://support.google.com/googleplay/android-developer/answer/9866151

## 7. Testing tracks

1. Internal testing: upload the signed AAB and verify installation/update behavior.
2. Closed testing: recruit real testers, give them clear test instructions and collect feedback.
3. For personal developer accounts created after 13 November 2023, Google currently requires at least 12 testers to remain opted in continuously for at least 14 days before applying for production access. Confirm whether this requirement applies to the developer account.
4. Fix all crashes, broken search/API paths, inaccurate route data and privacy issues before applying for production access.
5. Apply for production access in Play Console only after the applicable test requirement is satisfied.

Official testing guidance: https://support.google.com/googleplay/android-developer/answer/14151465

## 8. Technical release gates

- [ ] Phase 8 signed release workflow passes and creates both APK and AAB.
- [ ] Verify APK signature with `apksigner`; verify AAB signature with `jarsigner`.
- [ ] Keep the release keystore and recovery backup outside Git; protect it with access controls.
- [ ] Preserve the same signing key for all future updates (or configure Play App Signing correctly).
- [ ] Increase `versionCode` for every upload; never reuse a previously uploaded version code.
- [ ] Build with production HTTPS API URL; verify API health and persistence after restart.
- [ ] Verify bus search results and schedule data against actual approved data; sample schedules must not be represented as official.
- [ ] Test clean install, upgrade install, low network, offline, location permissions, GPS consent, stop-sharing and notifications on supported Android versions.
- [ ] Check crash-free operation, accessibility, app navigation and all three languages.
- [ ] Ensure public privacy policy URL and developer contact are live.
- [ ] Complete Data Safety and all App content forms truthfully.
- [ ] Confirm Play Console review and release rollout only after owner approval.

## 9. Current blockers — do not call the app launch-ready

1. The backend runtime is still a single-process JSON-file repository; PostgreSQL/D1 production persistence is not complete.
2. The deployed website/API URL and native app API connectivity have not been proven end-to-end.
3. Nationwide verified bus schedules and stops are not complete; the repository itself warns that sample records are not a nationwide verified feed.
4. Background-location policy approval has not been obtained; the Play Console declaration and real-device video are still required.
5. The privacy policy URL and developer contact email need live verification and owner-supplied contact details.
6. Signed release artifacts and real-device acceptance tests have not yet been verified.
7. Play Console developer account ownership, account type, registration status and testing eligibility are not known from the repository.

## 10. Official Play Console entry points

- Play Console: https://play.google.com/console/
- Target API requirement: https://developer.android.com/google/play/requirements/target-sdk
- New personal account testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Background location policy: https://support.google.com/googleplay/android-developer/answer/9799150
- Store listing assets: https://support.google.com/googleplay/android-developer/answer/9866151
- User data / privacy policy: https://support.google.com/googleplay/android-developer/answer/10144311
