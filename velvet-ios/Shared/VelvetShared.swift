import Foundation

enum VelvetShared {
    static let groupName = "group.com.velvetassistant.VelvetAI"
    static let key = "visibleMessengerText"
    static let updated = "lastScreenRecognitionAt"

    static func storeVisibleText(_ text: String) {
        guard let store = UserDefaults(suiteName: groupName) else { return }
        store.set(String(text.prefix(6000)), forKey: key)
        store.set(Date().timeIntervalSince1970, forKey: updated)
    }

    static func latestVisibleText() -> String {
        UserDefaults(suiteName: groupName)?.string(forKey: key) ?? ""
    }
}
