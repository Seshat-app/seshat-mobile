import AppIntents

// "Log bank message" — a native Shortcuts action exposed by the Seshat app.
//
// A Personal Automation ("When I receive a message that contains EGP") passes the
// message text to this action; the app opens and shows its capture screen, which parses
// the amount and merchant and asks the user to confirm. Nothing is sent anywhere
// from the Shortcuts side — the text goes straight to this app on the same phone.
@available(iOS 16.0, *)
struct LogBankMessageIntent: AppIntent {
  static var title: LocalizedStringResource = "Log bank message"
  static var description = IntentDescription(
    "Sends a bank or wallet message to Seshat so it can be logged as a transaction."
  )
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Message")
  var message: String

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$message) in Seshat")
  }

  // Hand the text to the app through a small file in its own Documents folder; the app
  // reads and deletes it as soon as it is active (see lib/pendingCapture.ts). A file
  // survives a cold start, unlike a URL opened before the JavaScript side is listening.
  @MainActor
  func perform() async throws -> some IntentResult {
    if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      let file = dir.appendingPathComponent("pending-capture.txt")
      try? message.write(to: file, atomically: true, encoding: .utf8)
    }
    return .result()
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
