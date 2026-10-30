import Foundation

/// English / Arabic text. Widgets follow the phone's language (and mirror automatically).
enum L {
  static var isArabic: Bool { Locale.preferredLanguages.first?.hasPrefix("ar") == true }

  static func t(_ en: String, _ ar: String) -> String { isArabic ? ar : en }

  /// 1,234 / 12.4K / 1.2M, no decimals under 10,000.
  static func compact(_ value: Double) -> String {
    let v = abs(value)
    if v >= 1_000_000 { return String(format: "%.1fM", v / 1_000_000) }
    if v >= 10_000 { return String(format: "%.1fK", v / 1_000) }
    return full(v)
  }

  static func full(_ value: Double) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return f.string(from: NSNumber(value: value.rounded())) ?? "\(Int(value))"
  }

  static func currency(_ code: String) -> String {
    guard isArabic else { return code }
    return code == "EGP" ? "ج.م" : code
  }
}
