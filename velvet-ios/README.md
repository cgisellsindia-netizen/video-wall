# Velvet AI Keyboard — iPhone prototype

The active iOS target is **VelvetApp + VelvetKeyboard**, not the previous screen-broadcast prototype. The source is in `velvet-ios/` on branch `velvet-render-app`.

## User flow
1. Copy a message from Messenger (user action).
2. Focus Messenger's composer and switch to Velvet Keyboard via the iPhone globe key.
3. Type a conversation label and tap **Import copied text**. iOS may ask for permission to paste.
4. Tap **Suggest** for a locally generated draft.
5. Review, tap **Insert reply** to place it in Messenger's composer, and press Send yourself.

## Privacy
- No screenshots, screen recording, or OCR in the active targets.
- Nothing is read automatically from Messenger.
- Clipboard is only read when Import is tapped.
- The app stores up to the last 35 imported messages per named conversation in local App Group UserDefaults.
- The keyboard does not send messages to a server. **Allow Full Access** is requested for writing to the shared App Group container. The user must explicitly enable it in iOS Settings. Despite that permission, this prototype contains no network-upload functionality.
- The reply engine is a simple local template; it is NOT a cloud or generative AI service.
- No external AI account or ChatGPT conversation is synchronized.
- A production AI backend would require authentication, encrypted transport, retention controls, and a separate explicit Submit-to-AI action; do not collect all keystrokes.

## Build
`.github/workflows/velvet-ios-macos.yml` builds an unsigned iOS Payload archive on a macOS GitHub Actions runner. Check that build logs show Xcode success. This does not sign or install the app.

The IPA must be signed with Apple-issued credentials and valid app + keyboard extension provisioning. A free Apple ID normally requires direct development with Xcode and cannot guarantee no-computer installation. Do not send private signing credentials to chat.
