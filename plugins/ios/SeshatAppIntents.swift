import AppIntents
import UIKit

// "Log bank message" — a native Shortcuts action exposed by the Seshat app.
//
// A Personal Automation ("When I receive a message that contains EGP") passes the
// message text to this action; it opens Seshat on its capture screen, which parses
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

  @MainActor
  func perform() async throws -> some IntentResult {
    var comps = URLComponents()
    comps.scheme = "seshat"
    comps.host = "capture"
    comps.queryItems = [
      URLQueryItem(name: "text", value: message),
      URLQueryItem(name: "source", value: "sms"),
    ]
    if let url = comps.url {
      await UIApplication.shared.open(url)
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
