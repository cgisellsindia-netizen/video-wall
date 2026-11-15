# Velvet Messenger Copilot (Chrome / Edge desktop)

This is a personal-use, on-demand companion to https://velvet-ai-live.onrender.com . It reads only text currently visible in a Messenger conversation when the user clicks **Read open conversation**. It generates local, template-based suggested replies and **never sends messages automatically**. It does not connect to Meta's official Messenger API or guarantee conversation extraction, which may break when Facebook changes its interface.

## Install

1. Download this folder from the GitHub repository and put the three files together in one local directory.
2. Visit chrome://extensions (or edge://extensions), enable Developer Mode, click **Load unpacked**, and select the directory.
3. Open https://www.facebook.com/messages/ and select a conversation, then click the Velvet extension icon and **Read open conversation**.
4. Review extracted text, choose a style, click **Suggest reply**, and use **Copy reply**. Review and manually send in Messenger.

## Privacy

No page content is automatically uploaded to a server; Chrome's activeTab permission is only used when you click the extension action. There is no automated scanning, no message sending, and no background tracking. Messages can be incomplete or incorrectly identified. The extension does not require or store your Facebook password.
