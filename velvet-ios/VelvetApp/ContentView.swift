import SwiftUI

struct ContentView: View {
    @State private var conversation = "Default"
    @State private var message = ""
    @State private var reply = ""
    @State private var replyTone: ReplyTone = .friendly

    var body: some View {
        NavigationStack {
            Form {
                Section("Velvet AI Keyboard") {
                    Text("Copy a Messenger message, switch to the Velvet keyboard and tap Import copied text. The keyboard creates a local suggestion and inserts only when you approve.")
                    Text("Enable Velvet: Settings → General → Keyboard → Keyboards → Add New Keyboard → Velvet Keyboard.")
                    Text("For storing separate local conversations, iOS requires Allow Full Access. Velvet has no automatic upload feature.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("Local conversation") {
                    TextField("Conversation name", text: $conversation)
                    TextEditor(text: $message).frame(minHeight: 100)
                    Button("Paste copied message") {
                        message = UIPasteboard.general.string ?? ""
                    }
                    Button("Save text locally") {
                        let defaults = UserDefaults(suiteName: "group.com.velvetassistant.VelvetAI")
                        let name = conversation.trimmingCharacters(in: .whitespacesAndNewlines)
                        let key = "conversation." + String((name.isEmpty ? "Default" : name).prefix(50))
                        var messages = defaults?.stringArray(forKey: key) ?? []
                        messages.append(String(message.prefix(4000)))
                        defaults?.set(Array(messages.suffix(35)), forKey: key)
                    }.disabled(message.isEmpty)
                }
                Section("Local reply suggestion") {
                    Picker("Tone", selection: $replyTone) {
                        ForEach(ReplyTone.allCases) { tone in Text(tone.rawValue).tag(tone) }
                    }.pickerStyle(.segmented)
                    Button("Suggest reply") { reply = ReplyComposer.suggest(message, tone: replyTone) }
                        .disabled(message.isEmpty)
                    if !reply.isEmpty { Text(reply).textSelection(.enabled); ShareLink(item: reply) }
                }
                Section("Privacy") {
                    Text("No screenshot capture and no automatic transmission of typing or Messenger messages. This is a prototype with local templates, not a connected generative AI model.")
                        .font(.footnote)
                }
            }
            .navigationTitle("Velvet AI")
        }
    }
}

enum ReplyTone: String, CaseIterable, Identifiable {
    case friendly = "Friendly", playful = "Playful", direct = "Direct"
    var id: Self { self }
}

enum ReplyComposer {
    static func suggest(_ text: String, tone: ReplyTone) -> String {
        let lower = text.lowercased()
        if lower.contains("leave me alone") || lower.contains("not interested") || lower.contains("stop messaging") {
            return "I understand, and I'll respect your wishes."
        }
        if lower.contains("under 18") || lower.contains("i am 16") || lower.contains("i am 17") {
            return "Thanks for chatting. Let's keep things appropriate."
        }
        if lower.contains("?") {
            return "That sounds interesting! What did you have in mind?"
        }
        switch tone {
        case .friendly: return "It's nice hearing from you! How have you been?"
        case .playful: return "You've got me curious 😊 Tell me more!"
        case .direct: return "Thanks for sharing that. I'd like to know more, if you're comfortable."
        }
    }
}
