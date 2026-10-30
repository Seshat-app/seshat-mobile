import WidgetKit
import SwiftUI

/// "Month at a glance": spent so far against the budget (or income), today, and the last entry.
struct MonthViewContent: View {
  let entry: SummaryEntry
  var family: WidgetFamily

  var body: some View {
    if let s = entry.summary {
      content(s).widgetURL(URL(string: "seshat://"))
    } else {
      EmptyState(signedIn: entry.signedIn)
    }
  }

  /// What the ring measures: budget used if budgets exist, otherwise spent against income.
  private func ring(_ s: WidgetSummary) -> (progress: Double, label: String, color: Color) {
    if let p = s.budgetPercent { return (Double(p) / 100, "\(p)%", Theme.tone(p)) }
    if s.monthIncome > 0 {
      let p = Int((s.monthSpent / s.monthIncome * 100).rounded())
      return (Double(p) / 100, "\(p)%", Theme.tone(p))
    }
    return (0, "—", Theme.gold)
  }

  @ViewBuilder
  private func content(_ s: WidgetSummary) -> some View {
    let r = ring(s)
    let cur = L.currency(s.currency)
    if family == .systemSmall {
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(text: L.t("This month", "هذا الشهر"))
        HStack {
          ZStack {
            Ring(progress: r.progress, lineWidth: 7, color: r.color)
            Text(r.label).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(Theme.text)
          }
          .frame(width: 56, height: 56)
          Spacer(minLength: 0)
        }
        Spacer(minLength: 0)
        Text(L.compact(s.monthSpent))
          .font(.system(size: 28, weight: .bold, design: .rounded))
          .foregroundStyle(Theme.text)
          .minimumScaleFactor(0.6)
          .lineLimit(1)
        Text("\(cur) · " + L.t("spent", "مصروف"))
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(Theme.dim)
      }
    } else {
      HStack(spacing: 16) {
        ZStack {
          Ring(progress: r.progress, lineWidth: 10, color: r.color)
          VStack(spacing: 0) {
            Text(r.label).font(.system(size: 20, weight: .bold, design: .rounded)).foregroundStyle(Theme.text)
            Text(s.budgetPercent != nil ? L.t("of budget", "من الميزانية") : L.t("of income", "من الدخل"))
              .font(.system(size: 9, weight: .medium)).foregroundStyle(Theme.dim)
          }
        }
        .frame(width: 96, height: 96)

        VStack(alignment: .leading, spacing: 8) {
          Eyebrow(text: L.t("Spent this month", "المصروف هذا الشهر"))
          Text("\(L.full(s.monthSpent)) \(cur)")
            .font(.system(size: 26, weight: .bold, design: .rounded))
            .foregroundStyle(Theme.text)
            .minimumScaleFactor(0.6).lineLimit(1)
          HStack(spacing: 14) {
            stat(L.t("Today", "اليوم"), "\(L.full(s.todaySpent))")
            if s.monthIncome > 0 { stat(L.t("Income", "الدخل"), "\(L.full(s.monthIncome))") }
          }
          if let last = s.last {
            HStack(spacing: 5) {
              CategoryGlyph(icon: last.icon, size: 11, color: Theme.dim)
              Text("\(last.counterparty.isEmpty ? last.category : last.counterparty) · \(last.type == "income" ? "+" : "−")\(L.full(last.amount))")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.dim)
                .lineLimit(1)
            }
          }
        }
        Spacer(minLength: 0)
      }
    }
  }

  private func stat(_ title: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(title).font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.dim)
      Text(value).font(.system(size: 14, weight: .semibold, design: .rounded)).foregroundStyle(Theme.text)
    }
  }
}


/// Reads the widget size from the environment and hands it to the content view.
struct MonthView: View {
  let entry: SummaryEntry
  @Environment(\.widgetFamily) private var family
  var body: some View { MonthViewContent(entry: entry, family: family) }
}

struct MonthWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SeshatMonth", provider: SummaryProvider()) { entry in
      MonthView(entry: entry).containerBackground(for: .widget) { Theme.background }
    }
    .configurationDisplayName(L.t("Month at a glance", "شهرك بنظرة"))
    .description(L.t("What you have spent this month against your budget, and today.", "ما أنفقته هذا الشهر مقابل ميزانيتك، واليوم."))
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
