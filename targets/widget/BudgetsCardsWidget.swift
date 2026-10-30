import WidgetKit
import SwiftUI

/// Budgets as progress bars, and (on the large size) spending per bank card.
struct BudgetsCardsViewContent: View {
  let entry: SummaryEntry
  var family: WidgetFamily

  var body: some View {
    if let s = entry.summary {
      content(s).widgetURL(URL(string: "seshat://"))
    } else {
      EmptyState(signedIn: entry.signedIn)
    }
  }

  @ViewBuilder
  private func content(_ s: WidgetSummary) -> some View {
    let cur = L.currency(s.currency)
    let budgetCount = family == .systemLarge ? 4 : 3
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Eyebrow(text: L.t("Budgets", "الميزانيات"))
        Spacer()
        Text("\(L.full(s.monthSpent)) \(cur)")
          .font(.system(size: 11, weight: .semibold, design: .monospaced))
          .foregroundStyle(Theme.dim)
      }
      if s.budgets.isEmpty {
        Text(L.t("No budgets yet. Add one in Seshat and it shows up here.", "لا توجد ميزانيات بعد. أضف واحدة في سيشات لتظهر هنا."))
          .font(.system(size: 12)).foregroundStyle(Theme.dim)
      } else {
        ForEach(s.budgets.prefix(budgetCount)) { b in
          VStack(spacing: 4) {
            HStack {
              Text("\(b.emoji) \(b.name)").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
              Spacer()
              Text("\(b.percent)%").font(.system(size: 11, weight: .bold, design: .rounded)).foregroundStyle(Theme.tone(b.percent))
            }
            Bar(progress: Double(b.percent) / 100, color: Theme.tone(b.percent))
          }
        }
      }
      if family == .systemLarge {
        Divider().overlay(Theme.surfaceHigh)
        Eyebrow(text: L.t("By card", "حسب البطاقة"))
        if s.cards.isEmpty {
          Text(L.t("Card spending appears once bank messages are logged.", "يظهر إنفاق البطاقات بعد تسجيل رسائل البنك."))
            .font(.system(size: 12)).foregroundStyle(Theme.dim)
        } else {
          let top = s.cards.map(\.spent).max() ?? 1
          ForEach(s.cards.prefix(3)) { c in
            VStack(spacing: 4) {
              HStack {
                Text(c.label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Spacer()
                Text("\(L.full(c.spent)) \(cur)").font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundStyle(Theme.dim)
              }
              Bar(progress: top > 0 ? c.spent / top : 0, color: Theme.gold.opacity(0.85), height: 5)
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
  }
}


/// Reads the widget size from the environment and hands it to the content view.
struct BudgetsCardsView: View {
  let entry: SummaryEntry
  @Environment(\.widgetFamily) private var family
  var body: some View { BudgetsCardsViewContent(entry: entry, family: family) }
}

struct BudgetsCardsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SeshatBudgets", provider: SummaryProvider()) { entry in
      BudgetsCardsView(entry: entry).containerBackground(for: .widget) { Theme.background }
    }
    .configurationDisplayName(L.t("Budgets and cards", "الميزانيات والبطاقات"))
    .description(L.t("Your budgets as progress bars, and spending per card.", "ميزانياتك كأشرطة تقدم، والإنفاق لكل بطاقة."))
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
