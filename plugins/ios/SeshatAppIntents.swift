import AppIntents
import Foundation
import Security

// "Log bank message" — a native Shortcuts action exposed by the Seshat app.
//
// A Personal Automation ("When I receive a message that contains EGP") passes the message
// text to this action. It runs in the BACKGROUND, without opening the app: the text is sent
// to the Seshat API (over HTTPS, with a capture-only token), where it is parsed, categorised,
// matched to the card it names, and logged. The app is only involved if the phone is offline;
// then the text is parked on disk and delivered the next time the app is opened.

private struct CaptureConfig: Decodable {
  let token: String
  let api: String
}

private enum Capture {
  /// Config written by the JS side with expo-secure-store (service "app:no-auth", key "capture_config").
  static func config() -> CaptureConfig? {
    let key = Data("capture_config".utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "app:no-auth",
      kSecAttrAccount as String: key,
      kSecAttrGeneric as String: key,
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: true,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data else { return nil }
    return try? JSONDecoder().decode(CaptureConfig.self, from: data)
  }

  /// Returns a short human summary on success, nil when it could not be delivered.
  static func send(_ text: String) async -> String? {
    guard let cfg = config(), let url = URL(string: cfg.api + "/capture/auto") else { return nil }
    var req = URLRequest(url: url, timeoutInterval: 20)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer " + cfg.token, forHTTPHeaderField: "Authorization")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["text": text, "source": "sms"])
    guard let (data, resp) = try? await URLSession.shared.data(for: req),
          let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
    let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    let d = obj?["data"] as? [String: Any]
    if d?["duplicate"] as? Bool == true { return "Already logged" }
    if let tx = d?["transaction"] as? [String: Any], let amount = tx["amount"] as? Double {
      let cur = tx["currency"] as? String ?? ""
      let who = tx["counterparty"] as? String
      return "Logged \(Int(amount) == Int(exactly: amount) ? String(Int(amount)) : String(amount)) \(cur)" + (who.map { " · \($0)" } ?? "")
    }
    // Delivered, but it was not a transaction (OTP, promo…): nothing to log, nothing to retry.
    return d?["reason"] as? String ?? "Not a transaction"
  }

  /// Park the text so the app can deliver it later.
  static func park(_ text: String) {
    guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
    let dir = docs.appendingPathComponent("pending-captures", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    try? text.write(to: dir.appendingPathComponent(UUID().uuidString + ".txt"), atomically: true, encoding: .utf8)
  }
}

@available(iOS 16.0, *)
struct LogBankMessageIntent: AppIntent {
  static var title: LocalizedStringResource = "Log bank message"
  static var description = IntentDescription(
    "Logs a bank or wallet message in Seshat in the background: amount, merchant, category and card."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Message")
  var message: String

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$message) in Seshat")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    if let summary = await Capture.send(message) {
      return .result(dialog: IntentDialog(stringLiteral: summary))
    }
    Capture.park(message)
    return .result(dialog: "Saved — Seshat will log it the next time it opens")
  }
}

@available(iOS 16.0, *)
struct SeshatShortcutsProvider: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogBankMessageIntent(),
      phrases: ["Log a bank message in \(.applicationName)"],
      shortTitle: "Log bank message",
      systemImageName: "wallet.pass"
    )
  }
}
