import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { TrendingUp, TrendingDown, Sparkles, Download, Hourglass } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, REyebrow, RButton } from '../../components/ui';
import { useI18n, currencyLabel } from '../../lib/i18n';
import { hasToken, apiFetchText } from '../../lib/api';
import {
  getMonthlyReport, getReportAvailability, monthlyReportHtmlPath,
  type MonthlyReport, type ReportAvailability,
} from '../../lib/reports';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';

/**
 * /reports/monthly - the in-app native render of last/current month's
 * report. Same data as the email body but laid out for the device.
 * "Share PDF" button fetches the server-rendered HTML and pipes it through
 * expo-print to produce a PDF the user can share to anywhere (mail,
 * WhatsApp, Files).
 */
export default function MonthlyReportScreen() {
  const { tok, lang } = useI18n();
  const { profile } = useAppData();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [availability, setAvailability] = useState<ReportAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      // Check availability first so we never even attempt to build a
      // report when the user is still in the onboarding window. Saves a
      // round-trip to Groq + a clearer error path.
      const avail = await getReportAvailability();
      setAvailability(avail);
      if (avail.available) {
        const r = await getMonthlyReport();
        setReport(r);
      } else {
        setReport(null);
      }
    } catch (err) {
      console.warn('getMonthlyReport failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sharePdf = async () => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      // Print variant: light/cream palette, dark text, gold accents, A4
      // margins. Reads cleanly on white paper and when forwarded to mail
      // or WhatsApp - the dark in-app variant would just look like a bug
      // outside the app.
      const html = await apiFetchText(
        monthlyReportHtmlPath(report.period.year, report.period.month, lang, true),
      );
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: lang === 'ar' ? 'مشاركة التقرير' : 'Share report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(lang === 'ar' ? 'تم إنشاء الملف' : 'PDF created', uri);
      }
    } catch (err) {
      console.warn('PDF share failed', err);
      Alert.alert(
        lang === 'ar' ? 'تعذر إنشاء PDF' : 'Could not create PDF',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setExporting(false);
    }
  };

  const currency = report?.currency ?? profile?.currency ?? 'EGP';
  const fmtNum = (n: number) => Math.round(n).toLocaleString();

  return (
    <PlanScreen
      title={report ? report.period.label : (lang === 'ar' ? 'التقرير الشهري' : 'Monthly report')}
      subtitle={lang === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : 'Powered by Seshat'}
      refreshing={refreshing}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 160, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={tok.gold}
            colors={[tok.gold]}
            progressBackgroundColor={tok.surface}
          />
        }
      >
        {loading ? (
          <RCard padding={32}><ActivityIndicator color={tok.gold} /></RCard>
        ) : availability && !availability.available ? (
          <BrewingState availability={availability} tok={tok} lang={lang} />
        ) : !report ? (
          <RCard padding={32}>
            <Text style={{
              fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: 'center',
            }}>
              {lang === 'ar' ? 'تعذّر تحميل التقرير.' : 'Could not load the report.'}
            </Text>
          </RCard>
        ) : (
          <>
            {/* Totals row - income / expense / net */}
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              gap: 8, marginBottom: 14,
            }}>
              <TotalsCard
                label={lang === 'ar' ? 'الدخل' : 'Income'}
                value={`${fmtNum(report.totals.income)} ${currencyLabel(currency, lang)}`}
                deltaPercent={report.comparison.incomeDeltaPercent}
                positiveIsGood
                tok={tok} lang={lang}
              />
              <TotalsCard
                label={lang === 'ar' ? 'المصروف' : 'Expense'}
                value={`${fmtNum(report.totals.expense)} ${currencyLabel(currency, lang)}`}
                deltaPercent={report.comparison.expenseDeltaPercent}
                positiveIsGood={false}
                tok={tok} lang={lang}
              />
            </View>
            <RCard padding={16} style={{ marginBottom: 14 }}>
              <REyebrow style={{ marginBottom: 4, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                {lang === 'ar' ? 'الصافي' : 'Net'}
              </REyebrow>
              <Text style={{
                fontFamily: fontHead(lang), fontSize: 32, color: tok.gold,
                letterSpacing: -0.6, textAlign: lang === 'ar' ? 'right' : 'left',
              }}>
                {fmtNum(report.totals.net)} {currencyLabel(currency, lang)}
              </Text>
              <Text style={{
                marginTop: 6, fontFamily: fontMono(), fontSize: 12, color: tok.muted,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}>
                {report.totals.savingsRate}% {lang === 'ar' ? 'معدل الادخار' : 'savings rate'}
              </Text>
            </RCard>

            {/* AI insight: four short sections that should ALWAYS sit at
                the top of the screen because the whole point of the
                report is the insight, not the data restatement. */}
            {report.narrative ? (() => {
              const ins = lang === 'ar' ? report.narrative.ar : report.narrative.en;
              if (!ins?.headline && !ins?.whatChanged) return null;
              return (
                <>
                  {ins.headline ? (
                    <RCard padding={16} style={{ marginBottom: 12, borderColor: tok.gold, borderWidth: 1 }}>
                      <View style={{
                        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                        alignItems: 'center', gap: 8, marginBottom: 8,
                      }}>
                        <Sparkles size={14} color={tok.gold} />
                        <REyebrow>{lang === 'ar' ? 'العنوان' : 'Headline'}</REyebrow>
                      </View>
                      <Text style={{
                        fontFamily: fontHead(lang), fontSize: 18, lineHeight: 25, color: tok.bone,
                        letterSpacing: -0.2, textAlign: lang === 'ar' ? 'right' : 'left',
                      }}>
                        {ins.headline}
                      </Text>
                    </RCard>
                  ) : null}

                  <RCard padding={16} style={{ marginBottom: 14 }}>
                    <InsightBlock
                      label={lang === 'ar' ? 'ما الذي تغيّر' : 'What changed'}
                      body={ins.whatChanged} tok={tok} lang={lang}
                    />
                    <InsightBlock
                      label={lang === 'ar' ? 'النمط الخفي' : 'Hidden pattern'}
                      body={ins.hiddenPattern} tok={tok} lang={lang}
                    />
                    <View style={{
                      marginTop: 4, paddingTop: 14,
                      borderTopWidth: 1, borderTopColor: tok.border,
                    }}>
                      <InsightBlock
                        label={lang === 'ar' ? 'افعل هذا الشهر القادم' : 'Do this next month'}
                        body={ins.doThis} tok={tok} lang={lang}
                        accent
                      />
                    </View>
                  </RCard>

                  <REyebrow style={{
                    marginTop: 4, marginBottom: 10, textAlign: 'center',
                  }}>
                    {lang === 'ar' ? '— الأرقام الداعمة —' : '— Supporting numbers —'}
                  </REyebrow>
                </>
              );
            })() : null}

            {/* By category */}
            <REyebrow style={{ marginTop: 6, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
              {lang === 'ar' ? 'حسب الفئة' : 'By category'}
            </REyebrow>
            <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14 }}>
              {report.byCategory.length === 0 ? (
                <Text style={{
                  fontFamily: fontBody(lang), fontSize: 13, color: tok.muted,
                  textAlign: 'center', paddingVertical: 16,
                }}>
                  {lang === 'ar' ? 'لا مصروفات هذا الشهر.' : 'No expenses this month.'}
                </Text>
              ) : report.byCategory.slice(0, 10).map((c, i) => (
                <View key={c.categoryId} style={{
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', paddingVertical: 12,
                  borderBottomWidth: i === Math.min(9, report.byCategory.length - 1) ? 0 : 1,
                  borderBottomColor: tok.border, gap: 10,
                }}>
                  <Text style={{ fontSize: 18 }}>{c.emoji ?? '·'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: fontBody(lang), fontSize: 14, color: tok.bone,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}>
                      {lang === 'ar' ? c.nameAr : c.nameEn}
                    </Text>
                    <Text style={{
                      fontFamily: fontMono(), fontSize: 11, color: tok.muted,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}>
                      {c.percentOfExpense}%  ·  {c.countTx}× {lang === 'ar' ? 'معاملة' : 'tx'}
                    </Text>
                  </View>
                  <View style={{ alignItems: lang === 'ar' ? 'flex-start' : 'flex-end' }}>
                    <Text style={{
                      fontFamily: fontMono(), fontSize: 14, color: tok.bone,
                    }}>
                      {fmtNum(c.total)}
                    </Text>
                    {c.deltaVsPrev !== 0 && (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
                      }}>
                        {c.deltaVsPrev > 0
                          ? <TrendingUp size={11} color={tok.alertText} />
                          : <TrendingDown size={11} color={tok.posText} />}
                        <Text style={{
                          fontFamily: fontMono(), fontSize: 10,
                          color: c.deltaVsPrev > 0 ? tok.alertText : tok.posText,
                        }}>
                          {fmtNum(Math.abs(c.deltaVsPrev))}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </RCard>

            {/* Top vendors */}
            {report.topVendors.length > 0 && (
              <>
                <REyebrow style={{ marginTop: 6, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                  {lang === 'ar' ? 'أكثر المصاريف تكراراً' : 'Top recurring expenses'}
                </REyebrow>
                <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14 }}>
                  {report.topVendors.map((v, i) => (
                    <View key={v.description + i} style={{
                      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                      alignItems: 'center', paddingVertical: 10,
                      borderBottomWidth: i === report.topVendors.length - 1 ? 0 : 1,
                      borderBottomColor: tok.border, gap: 10,
                    }}>
                      <Text style={{
                        flex: 1, fontFamily: fontBody(lang), fontSize: 13, color: tok.bone,
                        textAlign: lang === 'ar' ? 'right' : 'left',
                      }} numberOfLines={1}>
                        {v.description}
                      </Text>
                      <Text style={{ fontFamily: fontMono(), fontSize: 11, color: tok.muted }}>{v.count}×</Text>
                      <Text style={{ fontFamily: fontMono(), fontSize: 13, color: tok.bone }}>
                        {fmtNum(v.total)}
                      </Text>
                    </View>
                  ))}
                </RCard>
              </>
            )}

            {/* Budget adherence */}
            {report.budgetAdherence.length > 0 && (
              <>
                <REyebrow style={{ marginTop: 6, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                  {lang === 'ar' ? 'الالتزام بالميزانية' : 'Budget adherence'}
                </REyebrow>
                <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14 }}>
                  {report.budgetAdherence.map((b, i) => {
                    const color = b.status === 'over' ? tok.alertText
                      : b.status === 'near' ? tok.gold : tok.posText;
                    return (
                      <View key={b.categoryId} style={{
                        paddingVertical: 12,
                        borderBottomWidth: i === report.budgetAdherence.length - 1 ? 0 : 1,
                        borderBottomColor: tok.border, gap: 6,
                      }}>
                        <View style={{
                          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                          justifyContent: 'space-between',
                        }}>
                          <Text style={{
                            fontFamily: fontBody(lang), fontSize: 13, color: tok.bone,
                            textAlign: lang === 'ar' ? 'right' : 'left',
                          }}>
                            {lang === 'ar' ? b.nameAr : b.nameEn}
                          </Text>
                          <Text style={{ fontFamily: fontMono(), fontSize: 12, color }}>
                            {b.percent}%
                          </Text>
                        </View>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: tok.border, overflow: 'hidden' }}>
                          <View style={{
                            width: `${Math.min(100, b.percent)}%`, height: '100%', backgroundColor: color,
                          }} />
                        </View>
                        <Text style={{
                          fontFamily: fontMono(), fontSize: 10, color: tok.muted,
                          textAlign: lang === 'ar' ? 'right' : 'left',
                        }}>
                          {fmtNum(b.spent)} / {fmtNum(b.cap)} {currencyLabel(currency, lang)}
                        </Text>
                      </View>
                    );
                  })}
                </RCard>
              </>
            )}

            <RButton full onPress={sharePdf} disabled={exporting}>
              <View style={{
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 8,
              }}>
                <Download size={16} color={tok.void} />
                <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.void }}>
                  {exporting
                    ? (lang === 'ar' ? 'جاري إنشاء PDF…' : 'Building PDF…')
                    : (lang === 'ar' ? 'مشاركة كـ PDF' : 'Share as PDF')}
                </Text>
              </View>
            </RButton>
          </>
        )}
      </ScrollView>
    </PlanScreen>
  );
}

function BrewingState({
  availability, tok, lang,
}: { availability: Extract<ReportAvailability, { available: false }>; tok: any; lang: 'en' | 'ar' }) {
  const days = availability.daysUntilUnlock;
  const txs = availability.transactionsUntilUnlock;
  // Pick the more imminent gate to feature; mention both as the secondary line.
  const daysFirst = days >= txs;
  return (
    <RCard padding={24}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.gold,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Hourglass size={26} color={tok.gold} />
        </View>
        <Text style={{
          fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, letterSpacing: -0.3,
          textAlign: 'center',
        }}>
          {lang === 'ar' ? 'تقريرك يتشكّل' : 'Your report is brewing'}
        </Text>
        <Text style={{
          fontFamily: fontBody(lang), fontSize: 14, lineHeight: 22, color: tok.muted,
          textAlign: 'center', paddingHorizontal: 6,
        }}>
          {lang === 'ar'
            ? 'سيشات تحتاج بعض السجلات لتعطيك ملاحظات ذات قيمة بدلاً من إعادة سرد ما تراه أصلاً.'
            : 'Seshat needs more history to give you insights worth your time — not just a restatement of what the dashboard already shows.'}
        </Text>

        <View style={{
          marginTop: 8, width: '100%',
          backgroundColor: tok.surface, borderRadius: 12, padding: 14,
          gap: 10,
        }}>
          <ProgressRow
            label={lang === 'ar' ? 'أيام الاستخدام' : 'Days of use'}
            current={availability.daysSinceJoined}
            target={30}
            tok={tok} lang={lang}
            featured={daysFirst}
          />
          <ProgressRow
            label={lang === 'ar' ? 'المعاملات المسجَّلة' : 'Transactions logged'}
            current={availability.transactionCount}
            target={25}
            tok={tok} lang={lang}
            featured={!daysFirst}
          />
        </View>

        <Text style={{
          marginTop: 8, fontFamily: fontMono(), fontSize: 11, color: tok.gold,
          textAlign: 'center', letterSpacing: 1.4,
        }}>
          {days > 0 && txs > 0
            ? (lang === 'ar'
              ? `${days} يوم · ${txs} معاملة متبقية`
              : `${days} DAYS · ${txs} TX TO GO`)
            : days > 0
              ? (lang === 'ar' ? `${days} يوم متبقية` : `${days} DAYS TO GO`)
              : (lang === 'ar' ? `${txs} معاملة متبقية` : `${txs} TX TO GO`)}
        </Text>
      </View>
    </RCard>
  );
}

function ProgressRow({
  label, current, target, tok, lang, featured,
}: { label: string; current: number; target: number; tok: any; lang: 'en' | 'ar'; featured?: boolean }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <View>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        justifyContent: 'space-between', marginBottom: 6,
      }}>
        <Text style={{
          fontFamily: fontBody(lang), fontSize: 12,
          color: featured ? tok.bone : tok.muted,
        }}>
          {label}
        </Text>
        <Text style={{
          fontFamily: fontMono(), fontSize: 12,
          color: featured ? tok.gold : tok.muted,
        }}>
          {current} / {target}
        </Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: tok.border, overflow: 'hidden' }}>
        <View style={{
          width: `${pct}%`, height: '100%',
          backgroundColor: featured ? tok.gold : tok.muted,
        }} />
      </View>
    </View>
  );
}

function InsightBlock({
  label, body, tok, lang, accent,
}: { label: string; body: string; tok: any; lang: 'en' | 'ar'; accent?: boolean }) {
  if (!body) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{
        fontFamily: fontMono(),
        fontSize: 10, letterSpacing: 2, color: accent ? tok.gold : tok.muted,
        textTransform: 'uppercase', marginBottom: 6,
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: fontBody(lang), fontSize: accent ? 15 : 14, lineHeight: 22,
        color: tok.bone, fontWeight: accent ? '500' : '400',
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {body}
      </Text>
    </View>
  );
}

function TotalsCard({
  label, value, deltaPercent, positiveIsGood, tok, lang,
}: { label: string; value: string; deltaPercent: number; positiveIsGood: boolean; tok: any; lang: 'en' | 'ar' }) {
  const isUp = deltaPercent > 0;
  const goodDirection = positiveIsGood ? isUp : !isUp;
  const deltaColor = goodDirection ? tok.posText : tok.alertText;
  return (
    <View style={{
      flex: 1, backgroundColor: tok.surface, borderRadius: 14, padding: 14,
    }}>
      <REyebrow style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{label}</REyebrow>
      <Text style={{
        marginTop: 4, fontFamily: fontHead(lang), fontSize: 18, color: tok.bone,
        letterSpacing: -0.3, textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {value}
      </Text>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 4, marginTop: 6,
      }}>
        {isUp ? <TrendingUp size={11} color={deltaColor} /> : <TrendingDown size={11} color={deltaColor} />}
        <Text style={{ fontFamily: fontMono(), fontSize: 11, color: deltaColor }}>
          {Math.abs(deltaPercent)}%
        </Text>
      </View>
    </View>
  );
}
