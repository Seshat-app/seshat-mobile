import Foundation
import Security

// MARK: - Models (GET /api/v1/widget/summary)

struct WidgetSummary: Codable {
  var currency: String
  var monthSpent: Double
  var monthIncome: Double
  var monthCount: Int
  var todaySpent: Double
  var todayCount: Int
  var budgetLimit: Double
  var budgetPercent: Int?
  var budgets: [BudgetRow]
  var cards: [CardRow]
  var last: LastRow?
  var updatedAt: String

  struct BudgetRow: Codable, Identifiable {
    var nameEn: String
    var nameAr: String
    var icon: String
    var limit: Double
    var spent: Double
    var percent: Int
    var id: String { nameEn }
    var name: String { L.isArabic && !nameAr.isEmpty ? nameAr : nameEn }
  }

  struct CardRow: Codable, Identifiable {
    var label: String
    var spent: Double
    var count: Int
    var id: String { label }
  }

  struct LastRow: Codable {
    var counterparty: String
    var type: String
    var amount: Double
    var categoryEn: String
    var categoryAr: String
    var icon: String
    var date: String
    var category: String { L.isArabic && !categoryAr.isEmpty ? categoryAr : categoryEn }
  }

  /// Sample data for the widget gallery and placeholders.
  static let sample = WidgetSummary(
    currency: "EGP", monthSpent: 4280, monthIncome: 18000, monthCount: 62,
    todaySpent: 215, todayCount: 3, budgetLimit: 7500, budgetPercent: 57,
    budgets: [
      .init(nameEn: "Food & Dining", nameAr: "الطعام", icon: "food", limit: 2200, spent: 1840, percent: 84),
      .init(nameEn: "Transport", nameAr: "المواصلات", icon: "transport", limit: 1200, spent: 640, percent: 53),
      .init(nameEn: "Shopping", nameAr: "التسوق", icon: "shopping", limit: 1500, spent: 1620, percent: 108),
      .init(nameEn: "Bills", nameAr: "الفواتير", icon: "bill", limit: 2600, spent: 900, percent: 35),
    ],
    cards: [
      .init(label: "CIB ••4821", spent: 2310, count: 31),
      .init(label: "QNB ••7710", spent: 1240, count: 18),
      .init(label: "Telda ••3321", spent: 730, count: 13),
    ],
    last: .init(counterparty: "Cilantro Zamalek", type: "expense", amount: 60, categoryEn: "Food & Dining",
                categoryAr: "الطعام", icon: "food", date: "2026-10-30T10:12:00.000Z"),
    updatedAt: "2026-10-30T10:30:00.000Z"
  )
}

// MARK: - Device token (shared keychain)

private struct DeviceConfig: Decodable {
  let token: String
  let api: String
}

private enum DeviceKeychain {
  /// The app's keychain access group: this extension's own default group minus ".widget"
  /// (TEAMID.com.seshat.mobile.widget -> TEAMID.com.seshat.mobile).
  static func appGroup() -> String? {
    let probe: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "seshat.widget.probe",
      kSecAttrAccount as String: "probe",
      kSecReturnAttributes as String: true,
    ]
    var out: CFTypeRef?
    var status = SecItemCopyMatching(probe as CFDictionary, &out)
    if status == errSecItemNotFound {
      var add = probe
      add[kSecReturnAttributes as String] = nil
      add[kSecValueData as String] = Data("1".utf8)
      SecItemAdd(add as CFDictionary, nil)
      status = SecItemCopyMatching(probe as CFDictionary, &out)
    }
    guard status == errSecSuccess,
          let attrs = out as? [String: Any],
          let group = attrs[kSecAttrAccessGroup as String] as? String,
          group.hasSuffix(".widget") else { return nil }
    return String(group.dropLast(".widget".count))
  }

  /// Written by the app with expo-secure-store (service "app:no-auth", key "capture_config").
  static func config() -> DeviceConfig? {
    guard let group = appGroup() else { return nil }
    let key = Data("capture_config".utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "app:no-auth",
      kSecAttrAccount as String: key,
      kSecAttrGeneric as String: key,
      kSecAttrAccessGroup as String: group,
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: true,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data else { return nil }
    return try? JSONDecoder().decode(DeviceConfig.self, from: data)
  }
}

// MARK: - Fetch + cache

enum SummaryStore {
  private static let cacheKey = "widget.summary.v1"

  /// True when the app has stored a device token (the user is signed in).
  static var isSignedIn: Bool { DeviceKeychain.config() != nil }

  /// The latest summary from the API, falling back to the last good one (offline, token expired).
  static func load() async -> WidgetSummary? {
    if let fresh = await fetch() {
      if let data = try? JSONEncoder().encode(fresh) { UserDefaults.standard.set(data, forKey: cacheKey) }
      return fresh
    }
    return cached()
  }

  static func cached() -> WidgetSummary? {
    guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
    return try? JSONDecoder().decode(WidgetSummary.self, from: data)
  }

  private static func fetch() async -> WidgetSummary? {
    guard let cfg = DeviceKeychain.config(), let url = URL(string: cfg.api + "/widget/summary") else { return nil }
    var req = URLRequest(url: url, timeoutInterval: 15)
    req.setValue("Bearer " + cfg.token, forHTTPHeaderField: "Authorization")
    guard let (data, resp) = try? await URLSession.shared.data(for: req),
          let http = resp as? HTTPURLResponse, http.statusCode == 200 else { return nil }
    struct Envelope: Decodable { let data: WidgetSummary }
    return (try? JSONDecoder().decode(Envelope.self, from: data))?.data
  }
}
