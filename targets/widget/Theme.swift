import SwiftUI
import UIKit

/// The Seshat look: near-black void, gold accent, warm off-white text.
enum Theme {
  static let void = Color(hex: 0x0D0D0D)
  static let surface = Color(hex: 0x17171B)
  static let surfaceHigh = Color(hex: 0x202026)
  static let gold = Color(hex: 0xC9A84C)
  static let goldSoft = Color(hex: 0xC9A84C).opacity(0.16)
  static let text = Color(hex: 0xF2EEE3)
  static let dim = Color(hex: 0x8D877B)
  static let good = Color(hex: 0x6FCF97)
  static let warn = Color(hex: 0xE6B455)
  static let bad = Color(hex: 0xE5736A)

  /// Background used by every home-screen widget.
  static var background: some View {
    ZStack {
      void
      RadialGradient(colors: [gold.opacity(0.16), .clear], center: .topTrailing, startRadius: 0, endRadius: 220)
    }
  }

  /// Colour for a budget percentage: calm, near the limit, over it.
  static func tone(_ percent: Int) -> Color {
    percent >= 100 ? bad : (percent >= 80 ? warn : gold)
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

/// A thin ring that fills clockwise from the top.
struct Ring: View {
  var progress: Double
  var lineWidth: CGFloat = 9
  var color: Color = Theme.gold

  var body: some View {
    ZStack {
      Circle().stroke(Theme.surfaceHigh, lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: min(max(progress, 0), 1))
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
  }
}

/// A flat progress bar.
struct Bar: View {
  var progress: Double
  var color: Color = Theme.gold
  var height: CGFloat = 6

  var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(Theme.surfaceHigh)
        Capsule().fill(color).frame(width: max(height, g.size.width * min(max(progress, 0), 1)))
      }
    }
    .frame(height: height)
  }
}

/// Small mono label in the Seshat eyebrow style.
struct Eyebrow: View {
  var text: String
  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 9, weight: .medium, design: .monospaced))
      .tracking(1.6)
      .foregroundStyle(Theme.gold)
  }
}

/// A category's mark: the same lucide glyph the app and website use, bundled as a template
/// image named `cat-<icon key>` (unknown or empty keys fall back to the "other" box).
struct CategoryGlyph: View {
  /// The bundle holding the icon assets (the widget extension itself; a test harness can point elsewhere).
  static var bundle: Bundle = .main

  var icon: String
  var size: CGFloat = 14
  var color: Color = Theme.gold

  var body: some View {
    let name = UIImage(named: "cat-\(icon)", in: Self.bundle, compatibleWith: nil) != nil ? "cat-\(icon)" : "cat-other"
    Image(name, bundle: Self.bundle)
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .frame(width: size, height: size)
      .foregroundStyle(color)
  }
}
