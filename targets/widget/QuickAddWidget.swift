import WidgetKit
import SwiftUI

/// Logging made one tap: opens Seshat straight on the add sheet, the receipt scanner, or chat.
/// Static (no network), so it never shows stale or empty data.
struct QuickAddEntry: TimelineEntry { let date: Date }

struct QuickAddProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickAddEntry { QuickAddEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) { completion(QuickAddEntry(date: Date())) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
    completion(Timeline(entries: [QuickAddEntry(date: Date())], policy: .never))
  }
}

private func deepLink(_ path: String) -> URL { URL(string: "seshat://" + path)! }

private struct Tile: View {
  var symbol: String
  var title: String
  var url: URL
  var prominent = false

  var body: some View {
    Link(destination: url) {
      VStack(spacing: 8) {
        Image(systemName: symbol)
          .font(.system(size: 22, weight: .semibold))
          .foregroundStyle(prominent ? Theme.void : Theme.gold)
          .frame(height: 28)
        Text(title)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(prominent ? Theme.void : Theme.text)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(prominent ? Theme.gold : Theme.surfaceHigh)
      )
    }
  }
}

struct QuickAddContent: View {
  var family: WidgetFamily

  var body: some View {
    switch family {
    case .systemSmall:
      VStack(spacing: 10) {
        Eyebrow(text: "Seshat")
        ZStack {
          Circle().fill(Theme.gold)
          Image(systemName: "plus").font(.system(size: 34, weight: .bold)).foregroundStyle(Theme.void)
        }
        .frame(width: 66, height: 66)
        .shadow(color: Theme.gold.opacity(0.35), radius: 10)
        Text(L.t("Add expense", "أضف مصروفاً"))
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(Theme.text)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .widgetURL(deepLink("add?mode=manual"))
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "plus").font(.system(size: 22, weight: .bold))
      }
      .widgetURL(deepLink("add?mode=manual"))
    default:
      VStack(alignment: .leading, spacing: 10) {
        Eyebrow(text: L.t("Quick add", "إضافة سريعة"))
        HStack(spacing: 10) {
          Tile(symbol: "plus", title: L.t("Add", "أضف"), url: deepLink("add?mode=manual"), prominent: true)
          Tile(symbol: "camera.viewfinder", title: L.t("Receipt", "إيصال"), url: deepLink("add?mode=receipt"))
          Tile(symbol: "sparkles", title: L.t("Ask Seshat", "اسأل سيشات"), url: deepLink("add?mode=chat"))
        }
      }
    }
  }
}

/// Reads the widget size from the environment and hands it to the content view.
struct QuickAddView: View {
  @Environment(\.widgetFamily) private var family
  var body: some View { QuickAddContent(family: family) }
}

struct QuickAddWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SeshatQuickAdd", provider: QuickAddProvider()) { _ in
      QuickAddView().containerBackground(for: .widget) { Theme.background }
    }
    .configurationDisplayName(L.t("Quick add", "إضافة سريعة"))
    .description(L.t("Log an expense, scan a receipt, or ask Seshat in one tap.", "سجّل مصروفاً أو امسح إيصالاً أو اسأل سيشات بلمسة."))
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
  }
}
