import WidgetKit
import SwiftUI

struct SummaryEntry: TimelineEntry {
  let date: Date
  /// nil = nothing to show yet (signed out, or the very first load failed).
  let summary: WidgetSummary?
  let signedIn: Bool
}

/// Shared by the data widgets: loads the summary and refreshes about every 20 minutes
/// (iOS decides the exact moment).
struct SummaryProvider: TimelineProvider {
  func placeholder(in context: Context) -> SummaryEntry {
    SummaryEntry(date: Date(), summary: .sample, signedIn: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (SummaryEntry) -> Void) {
    if context.isPreview {
      completion(SummaryEntry(date: Date(), summary: .sample, signedIn: true))
      return
    }
    Task {
      let s = await SummaryStore.load()
      completion(SummaryEntry(date: Date(), summary: s ?? .sample, signedIn: SummaryStore.isSignedIn))
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SummaryEntry>) -> Void) {
    Task {
      let s = await SummaryStore.load()
      let entry = SummaryEntry(date: Date(), summary: s, signedIn: SummaryStore.isSignedIn)
      completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(20 * 60))))
    }
  }
}

/// Shown when there is no data: signed out, or the first fetch has not succeeded.
struct EmptyState: View {
  var signedIn: Bool
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "sparkles").font(.system(size: 20)).foregroundStyle(Theme.gold)
      Text(signedIn ? L.t("Loading your month…", "جارٍ تحميل شهرك…") : L.t("Open Seshat to sign in", "افتح سيشات لتسجيل الدخول"))
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Theme.dim)
        .multilineTextAlignment(.center)
    }
    .padding(8)
  }
}
