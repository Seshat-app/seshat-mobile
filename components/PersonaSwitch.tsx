import { View, Text, Pressable } from 'react-native';
import { PenLine, Scale } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { PERSONAS, personaHint, type Persona } from '../lib/persona';

/**
 * Compact segmented toggle between the two personas (Seshat | Maat), in the
 * app's gold-on-void glass language — ported in spirit from the web
 * PersonaSwitch. A bordered tray holds two segments; the active one gets a
 * pale-gold fill with a gold ring and gold text, the inactive one stays dim.
 * RTL-aware (row direction flips) and accessible (each segment reports its
 * selected state).
 *
 * size 'sm' → icon only (fits a chat header row); 'md' → icon + persona name.
 * When `hint` is set the one-line capability subtitle renders under the tray
 * (Seshat acts, Maat only reads).
 */

const ORDER: Persona[] = ['seshat', 'maat'];
const ICONS: Record<Persona, typeof PenLine> = { seshat: PenLine, maat: Scale };

interface PersonaSwitchProps {
  value: Persona;
  onChange: (p: Persona) => void;
  size?: 'sm' | 'md';
  hint?: boolean;
}

export default function PersonaSwitch({ value, onChange, size = 'md', hint = false }: PersonaSwitchProps) {
  const { tok, lang } = useI18n();
  const iconOnly = size === 'sm';
  const iconSize = iconOnly ? 15 : 14;

  return (
    <View style={{ alignItems: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 2,
          padding: 3,
          borderRadius: 999,
          backgroundColor: tok.shellBg,
          borderWidth: 1,
          borderColor: tok.shellBorder,
        }}
      >
        {ORDER.map((key) => {
          const meta = PERSONAS[key];
          const Icon = ICONS[key];
          const active = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${meta.name[lang]} — ${meta.tagline[lang]}`}
              hitSlop={6}
              style={({ pressed }) => ({
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: iconOnly ? 0 : 6,
                height: 32,
                width: iconOnly ? 32 : undefined,
                paddingHorizontal: iconOnly ? 0 : 12,
                borderRadius: 999,
                backgroundColor: active ? tok.glowShellBg : 'transparent',
                borderWidth: 1,
                borderColor: active ? tok.glowShellBorder : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon
                size={iconSize}
                color={active ? tok.gold : tok.muted}
                strokeWidth={active ? 2 : 1.75}
              />
              {!iconOnly && (
                <Text
                  style={{
                    fontFamily: fontBody(lang, active ? 'semibold' : 'medium'),
                    fontSize: 13,
                    color: active ? tok.gold : tok.muted,
                  }}
                >
                  {meta.name[lang]}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {hint && (
        <Text
          style={{
            marginTop: 7,
            fontFamily: fontMono(),
            fontSize: 10.5,
            lineHeight: 15,
            color: tok.muted,
            letterSpacing: 0.2,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        >
          {personaHint(value, lang)}
        </Text>
      )}
    </View>
  );
}
