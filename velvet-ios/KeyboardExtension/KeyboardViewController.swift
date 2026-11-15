import UIKit

/// A consent-based keyboard: reads the clipboard ONLY when the user taps Import.
/// No screenshots, keylogging or automatic network transfers.
final class KeyboardViewController: UIInputViewController {
    private let conversation = UITextField()
    private let importedMessage = UITextView()
    private let suggestion = UITextView()
    private let status = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.13, green: 0.08, blue: 0.19, alpha: 1)
        setup()
    }

    private func setup() {
        let heading = UILabel()
        heading.text = "✦ Velvet AI Keyboard"
        heading.font = .boldSystemFont(ofSize: 18)
        heading.textColor = UIColor(red: 0.92, green: 0.76, blue: 0.49, alpha: 1)

        conversation.placeholder = "Conversation name, e.g. Friend A"
        conversation.backgroundColor = .white
        conversation.textColor = .black
        conversation.borderStyle = .roundedRect
        conversation.autocorrectionType = .no
        conversation.font = .systemFont(ofSize: 15)

        importedMessage.backgroundColor = .white
        importedMessage.textColor = .black
        importedMessage.font = .systemFont(ofSize: 15)
        importedMessage.text = "Tap Import after copying a Messenger message."
        importedMessage.isEditable = false
        importedMessage.layer.cornerRadius = 7

        suggestion.backgroundColor = UIColor(white: 0.97, alpha: 1)
        suggestion.textColor = .black
        suggestion.font = .systemFont(ofSize: 15)
        suggestion.isEditable = false
        suggestion.layer.cornerRadius = 7
        suggestion.text = "Suggested reply appears here."

        status.text = "Nothing is sent without your approval."
        status.font = .systemFont(ofSize: 12)
        status.textColor = .white
        status.numberOfLines = 2

        let row1 = UIStackView(arrangedSubviews: [
            makeButton("🌐", action: #selector(nextKeyboardTapped)),
            makeButton("Import copied text", action: #selector(importTapped)),
            makeButton("Suggest", action: #selector(suggestTapped))
        ])
        row1.axis = .horizontal
        row1.spacing = 6
        row1.distribution = .fillProportionally

        let row2 = UIStackView(arrangedSubviews: [
            makeButton("Insert reply", action: #selector(insertTapped)),
            makeButton("⌫", action: #selector(backspaceTapped))
        ])
        row2.axis = .horizontal
        row2.spacing = 7
        row2.distribution = .fillEqually

        let stack = UIStackView(arrangedSubviews: [heading, conversation, row1, importedMessage, suggestion, row2, status])
        stack.axis = .vertical
        stack.spacing = 7
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 9),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -9),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 7),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -9),
            importedMessage.heightAnchor.constraint(equalToConstant: 56),
            suggestion.heightAnchor.constraint(equalToConstant: 70),
            conversation.heightAnchor.constraint(equalToConstant: 34),
            row1.heightAnchor.constraint(equalToConstant: 42),
            row2.heightAnchor.constraint(equalToConstant: 42)
        ])
        // Allow the keyboard its natural size.
        let height = view.heightAnchor.constraint(greaterThanOrEqualToConstant: 310)
        height.priority = .defaultHigh
        height.isActive = true
    }

    private func makeButton(_ title: String, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.backgroundColor = UIColor(red: 0.40, green: 0.23, blue: 0.53, alpha: 1)
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 7
        button.titleLabel?.font = .boldSystemFont(ofSize: 13)
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    @objc private func nextKeyboardTapped() {
        advanceToNextInputMode()
    }

    @objc private func backspaceTapped() {
        textDocumentProxy.deleteBackward()
    }

    @objc private func importTapped() {
        // UIPasteboard access can produce a system privacy prompt.
        guard let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            status.text = "Copy a message in Messenger first."
            return
        }
        importedMessage.text = String(text.prefix(4000))
        let name = conversation.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        VelvetConversationStore.add(message: importedMessage.text, to: name.isEmpty ? "Default" : name)
        status.text = "Copied message imported into this conversation locally."
    }

    @objc private func suggestTapped() {
        let msg = importedMessage.text ?? ""
        guard !msg.isEmpty && !msg.contains("Tap Import") else {
            status.text = "Import a Messenger message first."
            return
        }
        suggestion.text = VelvetReply.suggest(msg)
        status.text = "Draft ready. Review, then tap Insert reply."
    }

    @objc private func insertTapped() {
        let text = suggestion.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !text.isEmpty && text != "Suggested reply appears here." else { return }
        textDocumentProxy.insertText(text)
        status.text = "Inserted into Messenger. Press Send yourself."
    }
}

enum VelvetReply {
    static func suggest(_ message: String) -> String {
        let lower = message.lowercased()
        if lower.contains("stop contacting") || lower.contains("leave me alone") || lower.contains("not interested") {
            return "I understand. I'll respect your decision."
        }
        if lower.contains("?") {
            return "That sounds interesting 😊 Could you tell me a little more?"
        }
        return "That sounds nice! I'd love to hear more about it."
    }
}

enum VelvetConversationStore {
    static func add(message: String, to name: String) {
        let defaults = UserDefaults(suiteName: "group.com.velvetassistant.VelvetAI")
        let key = "conversation." + String(name.prefix(50))
        var history = defaults?.stringArray(forKey: key) ?? []
        history.append(String(message.prefix(4000)))
        defaults?.set(Array(history.suffix(35)), forKey: key)
    }
}
