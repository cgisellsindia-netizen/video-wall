# Velvet AI iOS

Native SwiftUI + ReplayKit Broadcast Upload Extension + Vision OCR. Captured frames are processed on-device only; no screenshot uploading. This is an early prototype with template suggestions, not an integrated AI model.

## Cloud compile
The GitHub Actions workflow `velvet-ios-macos.yml` runs on a macOS runner and builds an unsigned simulator app / device archive for validating that the source compiles. An unsigned build cannot be installed on a physical iPhone.

## Installable IPA signing
Valid Apple signing material is required for the iPhone: a certificate with private key, provisioning profiles for BOTH application and broadcast extension including the App Group entitlement, and a target device registered to the profiles. Provisioning and distribution depend on the Apple Developer account/team. Do not upload certificates, passwords or Apple ID credentials into the repository or chat.

The user's free personal Apple account is not a paid Developer Program membership. GitHub cloud compilation does not grant Apple signing capabilities. A free Personal Team in local Xcode provides seven-day device provisioning with limits but is not an automatic signing workflow for a generic hosted runner.

No IPA from this workflow is installable unless signed with credentials registered to that device. The existing app is a prototype and should be tested on-device before relying on screen broadcast behavior.
