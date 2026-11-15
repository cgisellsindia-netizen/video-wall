import SwiftUI
import ReplayKit

struct ContentView: View {
    @State private var visibleText = ""
    @State private var suggestion = ""
    @State private var tone: ReplyTone = .friendly
    private let poll = Timer.publish(every: 2, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Velvet AI").font(.largeTitle.bold())
                    Text("On-device screen text recognition. No screenshots are uploaded or stored.")
                        .foregroundStyle(.secondary)
                    Text("Start broadcast intentionally, then switch to Messenger. Return here to see the most recently recognized visible text and a reply suggestion.")
                        .font(.callout)
                    BroadcastPicker().frame(width: 190, height: 55)
                    Text("Only share the screen while comfortable; stop broadcasting from iOS when done.")
                        .font(.caption).foregroundStyle(.secondary)
                    Divider()
                    HStack {
                        Text("Visible recognized text").font(.headline)
                        Spacer()
                        Button("Clear") { VelvetShared.storeVisibleText(""); visibleText = ""; suggestion = "" }
                    }
                    Text(visibleText.isEmpty ? "No text recognized yet. Start a broadcast and view a conversation." : visibleText)
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
                        .padding().background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
                    Picker("Reply tone", selection: $tone) {
                        ForEach(ReplyTone.allCases) { type in Text(type.rawValue).tag(type) }
                    }.pickerStyle(.segmented)
                    Button("Suggest reply locally") { suggestion = ReplyComposer.suggest(from: visibleText, tone: tone) }
                        .buttonStyle(.borderedProminent).disabled(visibleText.isEmpty)
                    if !suggestion.isEmpty {
                        Text(suggestion).textSelection(.enabled).padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
                        ShareLink(item: suggestion) { Label("Share or copy reply", systemImage: "square.and.arrow.up") }
                    }
                    Text("This starter does not include cloud AI, notifications, automatic messaging, or screenshot uploads. Suggestions use a local template until an AI model is connected.")
                        .font(.caption).foregroundStyle(.secondary)
                }.padding()
            }
            .navigationTitle("Velvet")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onReceive(poll) { _ in visibleText = VelvetShared.latestVisibleText() }
    }
}

struct BroadcastPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let view = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 190, height: 55))
        view.preferredExtension = "com.velvetassistant.VelvetAI.broadcast"
        view.showsMicrophoneButton = false
        return view
    }
    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}

enum ReplyTone: String, CaseIterable, Identifiable {
    case friendly = "Friendly", playful = "Playful", direct = "Direct"
    var id: Self { self }
}

enum ReplyComposer {
    static func suggest(from visibleText: String, tone: ReplyTone) -> String {
        if visibleText.range(of: "(?i)\\b(stop contacting|leave me alone|not interested)\\b", options: .regularExpression) != nil {
            return "Understood. I'll respect your wishes."
        }
        switch tone {
        case .friendly: return "It's nice talking with you! How has your day been?"
        case .playful: return "You seem fun to chat with. What's something that made you smile today?"
        case .direct: return "I'd like to get to know you better, if you're interested. No pressure."
        }
    }
}
