import WidgetKit
import SwiftUI

/// A progress bar that follows the lock screen's own tint (no fixed colours).
struct LockBar: View {
  var progress: Double
  var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(.secondary.opacity(0.35))
        Capsule().fill(.primary).frame(width: max(5, g.size.width * progress))
      }
    }
    .frame(height: 5)
  }
}

/// Lock-screen widgets: a budget ring, today's spend, and an inline summary.
struct LockScreenViewContent: View {
  let entry: SummaryEntry
  var family: WidgetFamily

  var body: some View {
    if let s = entry.summary {
      content(s).widgetURL(URL(string: "seshat://"))
    } else {
      Image(systemName: "sparkles")
    }
  }

  private func percent(_ s: WidgetSummary) -> Int? {
    if let p = s.budgetPercent { return p }
    if s.monthIncome > 0 { return Int((s.monthSpent / s.monthIncome * 100).rounded()) }
    return nil
  }

  @ViewBuilder
  private func content(_ s: WidgetSummary) -> some View {
    let cur = L.currency(s.currency)
    switch family {
    case .accessoryCircular:
      if let p = percent(s) {
        Gauge(value: min(Double(p), 100), in: 0...100) {
          Text("")
        } currentValueLabel: {
          Text("\(p)%").font(.system(size: 13, weight: .bold, design: .rounded))
        }
        .gaugeStyle(.accessoryCircular)
      } else {
        ZStack {
          AccessoryWidgetBackground()
          Text(L.compact(s.todaySpent)).font(.system(size: 14, weight: .bold, design: .rounded))
        }
      }
    case .accessoryInline:
      Text("Seshat · \(L.compact(s.monthSpent)) \(cur)")
    default: // accessoryRectangular
      VStack(alignment: .leading, spacing: 2) {
        Text(L.t("Today", "اليوم") + "  −\(L.full(s.todaySpent)) \(cur)")
          .font(.system(size: 13, weight: .semibold))
        Text(L.t("Month", "الشهر") + "  \(L.full(s.monthSpent)) \(cur)")
          .font(.system(size: 12))
        if let p = percent(s) { LockBar(progress: min(Double(p), 100) / 100) }
      }
    }
  }
}


/// Reads the widget size from the environment and hands it to the content view.
struct LockScreenView: View {
  let entry: SummaryEntry
  @Environment(\.widgetFamily) private var family
  var body: some View { LockScreenViewContent(entry: entry, family: family) }
}

struct LockScreenWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SeshatLock", provider: SummaryProvider()) { entry in
      LockScreenView(entry: entry).containerBackground(for: .widget) { Color.clear }
    }
    .configurationDisplayName(L.t("Seshat on the lock screen", "سيشات على شاشة القفل"))
    .description(L.t("Budget ring, today's spend and your month at a glance.", "حلقة الميزانية ومصروف اليوم وشهرك بنظرة."))
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}
