import WidgetKit
import SwiftUI

/// Maat's weighing of the month: the pace so far, projected to month end, against the budgets.
struct MaatViewContent: View {
  let entry: SummaryEntry
  var family: WidgetFamily

  var body: some View {
    if let s = entry.summary {
      content(s).widgetURL(URL(string: "seshat://"))
    } else {
      EmptyState(signedIn: entry.signedIn)
    }
  }

  private struct Look {
    var title: String
    var color: Color
  }

  private func look(_ state: String) -> Look {
    switch state {
    case "balanced": return Look(title: L.t("In balance", "في توازن"), color: Theme.good)
    case "leaning": return Look(title: L.t("Leaning heavy", "تميل للثقل"), color: Theme.warn)
    case "over": return Look(title: L.t("Over the line", "فوق الحد"), color: Theme.bad)
    default: return Look(title: L.t("Still weighing", "ما زالت تزن"), color: Theme.dim)
    }
  }

  /// "Heading for 7,100 of 7,500 EGP" or, before there is enough to judge, what Maat is waiting for.
  private func detail(_ v: WidgetSummary.Verdict, cur: String) -> String {
    guard v.state != "none" else {
      return L.t("A few more days of records and she can judge.", "بضعة أيام أخرى من السجلات وتستطيع الحكم.")
    }
    let tail = v.basis == "income" ? L.t(" income", " دخل") : ""
    return L.t("Heading for \(L.full(v.projected)) of \(L.full(v.limit)) \(cur)\(tail)",
               "في طريقك إلى \(L.full(v.projected)) من \(L.full(v.limit)) \(cur)\(tail)")
  }

  /// The pace against the limit: a beam with the limit as a tick and the projection as the fill.
  private func beam(_ v: WidgetSummary.Verdict, color: Color) -> some View {
    GeometryReader { g in
      let span = max(v.limit * 1.5, 1)
      let fill = min(max(v.projected / span, 0), 1)
      ZStack(alignment: .leading) {
        Capsule().fill(Theme.surfaceHigh)
        Capsule().fill(color).frame(width: max(6, g.size.width * fill))
        Rectangle().fill(Theme.text.opacity(0.85)).frame(width: 2, height: 11)
          .offset(x: g.size.width * (v.limit / span) - 1)
      }
    }
    .frame(height: 6)
  }

  @ViewBuilder
  private func content(_ s: WidgetSummary) -> some View {
    let cur = L.currency(s.currency)
    if let v = s.verdict {
      let l = look(v.state)
      switch family {
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 2) {
          HStack(spacing: 4) {
            MarkGlyph(name: "mark-scale", size: 11, color: .primary)
            Text(L.t("Maat", "ماعت")).font(.system(size: 11, weight: .semibold))
          }
          Text(l.title).font(.system(size: 15, weight: .bold))
          if v.state != "none" { LockBar(progress: min(v.projected / max(v.limit, 1), 1)) }
        }
      case .systemSmall:
        VStack(alignment: .leading, spacing: 7) {
          HStack(spacing: 5) {
            MarkGlyph(name: "mark-scale", size: 13)
            Eyebrow(text: L.t("Maat", "ماعت"))
          }
          Text(l.title).font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(l.color)
            .minimumScaleFactor(0.7).lineLimit(2)
          if v.state != "none" { beam(v, color: l.color) }
          Text(detail(v, cur: cur)).font(.system(size: 10.5, weight: .medium)).foregroundStyle(Theme.dim).lineLimit(3)
          Spacer(minLength: 0)
        }
      default:
        HStack(alignment: .top, spacing: 16) {
          VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
              MarkGlyph(name: "mark-scale", size: 13)
              Eyebrow(text: L.t("Maat's verdict", "حكم ماعت"))
            }
            Text(l.title).font(.system(size: 26, weight: .bold, design: .rounded)).foregroundStyle(l.color)
              .minimumScaleFactor(0.7).lineLimit(1)
            if v.state != "none" { beam(v, color: l.color) }
            Text(detail(v, cur: cur)).font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.dim).lineLimit(2)
            Spacer(minLength: 0)
          }
          VStack(alignment: .leading, spacing: 10) {
            stat(L.t("Days left", "أيام متبقية"), "\(v.daysLeft)")
            if let w = v.watch {
              VStack(alignment: .leading, spacing: 3) {
                Text(L.t("Watch", "راقب") + " · \(w.percent)%").font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.dim)
                HStack(spacing: 5) {
                  CategoryGlyph(icon: w.icon, size: 13)
                  Text(w.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                }
              }
            }
            Spacer(minLength: 0)
          }
          .frame(width: 118, alignment: .leading)
        }
      }
    } else {
      EmptyState(signedIn: entry.signedIn)
    }
  }

  private func stat(_ title: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(title).font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.dim)
      Text(value).font(.system(size: 18, weight: .semibold, design: .rounded)).foregroundStyle(Theme.text)
    }
  }
}


/// Reads the widget size from the environment and hands it to the content view.
struct MaatView: View {
  let entry: SummaryEntry
  @Environment(\.widgetFamily) private var family
  var body: some View { MaatViewContent(entry: entry, family: family) }
}

struct MaatWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SeshatMaat", provider: SummaryProvider()) { entry in
      MaatView(entry: entry).containerBackground(for: .widget) { Theme.background }
    }
    .configurationDisplayName(L.t("Maat's verdict", "حكم ماعت"))
    .description(L.t("Whether your month is in balance, weighed from your pace so far.", "هل شهرك في توازن؟ ماعت تزنه من وتيرة إنفاقك حتى الآن."))
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}
