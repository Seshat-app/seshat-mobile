import { memo } from 'react';
import { StyleSheet, Linking } from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';

/**
 * Themed markdown renderer for assistant replies. The personas (Maat / Seshat)
 * emit light markdown — short lists, a bold key figure, the occasional compact
 * table — so we render it on-brand instead of as flat text. Ports the mapping
 * spirit of the web src/components/ui/Markdown.tsx to react-native-markdown-display.
 *
 * USER messages stay plain text; only ASSISTANT content flows through here.
 * Raw HTML is never rendered (the parser escapes it), so this is XSS-safe.
 * Links open in the system browser via Linking (the library's default).
 */

function useMarkdownStyles() {
  const { tok, lang, mode } = useI18n();
  const rtl = lang === 'ar';
  const align = rtl ? 'right' : 'left';
  const codeSurface = mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';

  return StyleSheet.create({
    // The wrapper. Vertical rhythm comes from per-block margins below.
    body: {
      color: tok.bone,
      fontFamily: fontBody(lang),
      fontSize: rtl ? 15 : 14,
      lineHeight: 22,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
      flexWrap: 'wrap',
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: '100%',
    },
    // flexShrink lets a long line wrap inside the row-wrap paragraph instead of
    // running past the bubble edge and getting clipped.
    text: {
      flexShrink: 1,
      color: tok.bone,
      textAlign: align,
      writingDirection: rtl ? 'rtl' : 'ltr',
    },
    textgroup: {
      flexShrink: 1,
      textAlign: align,
    },
    // A bold key figure — the persona's emphasis. Medium weight, full-strength.
    strong: {
      fontFamily: fontBody(lang, 'semibold'),
      color: tok.bone,
    },
    em: {
      fontStyle: 'italic',
    },
    s: {
      textDecorationLine: 'line-through',
    },
    // Headings stay restrained — personas may drop a small heading before a table.
    heading1: {
      fontFamily: fontHead(lang),
      fontSize: 16,
      color: tok.bone,
      marginTop: 2,
      marginBottom: 6,
      textAlign: align,
    },
    heading2: {
      fontFamily: fontHead(lang),
      fontSize: 15,
      color: tok.bone,
      marginTop: 2,
      marginBottom: 6,
      textAlign: align,
    },
    heading3: {
      fontFamily: fontMono('regular'),
      fontSize: 10.5,
      letterSpacing: 1.4,
      textTransform: rtl ? 'none' : 'uppercase',
      color: tok.gold,
      marginTop: 2,
      marginBottom: 4,
      textAlign: align,
    },
    heading4: {
      fontFamily: fontMono('regular'),
      fontSize: 10.5,
      letterSpacing: 1.4,
      textTransform: rtl ? 'none' : 'uppercase',
      color: tok.gold,
      marginTop: 2,
      marginBottom: 4,
      textAlign: align,
    },
    heading5: {
      fontFamily: fontMono('regular'),
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: rtl ? 'none' : 'uppercase',
      color: tok.gold,
      marginBottom: 4,
      textAlign: align,
    },
    heading6: {
      fontFamily: fontMono('regular'),
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: rtl ? 'none' : 'uppercase',
      color: tok.muted,
      marginBottom: 4,
      textAlign: align,
    },
    hr: {
      backgroundColor: tok.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: 8,
    },
    // Lists: real bullets/numbers, gold markers, softer body colour.
    bullet_list: {
      marginBottom: 6,
    },
    ordered_list: {
      marginBottom: 6,
    },
    list_item: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      justifyContent: 'flex-start',
      marginBottom: 3,
    },
    bullet_list_icon: {
      color: tok.gold,
      fontSize: rtl ? 15 : 14,
      lineHeight: 22,
      marginLeft: rtl ? 8 : 2,
      marginRight: rtl ? 2 : 8,
    },
    bullet_list_content: {
      flex: 1,
    },
    ordered_list_icon: {
      color: tok.muted,
      fontFamily: fontMono('regular'),
      fontSize: rtl ? 14 : 13,
      lineHeight: 22,
      marginLeft: rtl ? 8 : 2,
      marginRight: rtl ? 2 : 8,
    },
    ordered_list_content: {
      flex: 1,
    },
    blockquote: {
      backgroundColor: 'transparent',
      borderColor: tok.gold,
      ...(rtl ? { borderRightWidth: 2, paddingRight: 10 } : { borderLeftWidth: 2, paddingLeft: 10 }),
      marginVertical: 4,
    },
    // Inline + block code — DM Mono on a faint surface, always LTR.
    code_inline: {
      fontFamily: fontMono('regular'),
      fontSize: 12.5,
      color: tok.bone,
      backgroundColor: codeSurface,
      borderRadius: 4,
      paddingHorizontal: 4,
      writingDirection: 'ltr',
    },
    code_block: {
      fontFamily: fontMono('regular'),
      fontSize: 12.5,
      color: tok.bone,
      backgroundColor: codeSurface,
      borderColor: tok.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginVertical: 4,
      writingDirection: 'ltr',
    },
    fence: {
      fontFamily: fontMono('regular'),
      fontSize: 12.5,
      color: tok.bone,
      backgroundColor: codeSurface,
      borderColor: tok.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginVertical: 4,
      writingDirection: 'ltr',
    },
    link: {
      color: tok.gold,
      textDecorationLine: 'underline',
    },
    // Table: the weigher's privilege — thin gold-tinted header, hairline rows.
    table: {
      borderColor: tok.shellBorder,
      borderWidth: 1,
      borderRadius: 8,
      marginVertical: 6,
      overflow: 'hidden',
    },
    thead: {
      backgroundColor: tok.glowShellBg,
    },
    th: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    tr: {
      borderColor: tok.shellBorder,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: rtl ? 'row-reverse' : 'row',
    },
    td: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
  });
}

function MarkdownImpl({ content }: { content: string }) {
  const styles = useMarkdownStyles();
  return (
    <MarkdownDisplay
      style={styles as any}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {content}
    </MarkdownDisplay>
  );
}

/** Memoized so streamed re-renders of sibling messages don't re-parse this one. */
export const Markdown = memo(MarkdownImpl);
export default Markdown;
