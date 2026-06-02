import { Fragment, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard } from './ui';
import { SETUP_ITEMS, type SetupProfile } from '../lib/setupRequirements';

// ─────────────────────────────────────────────────────────────
// SetupPrompt — a flexible "finish your setup" banner. It reads the setup
// requirements registry, shows the first outstanding item as a gold-accent
// card, and opens that item's editor on tap. As each item is saved, the
// parent refreshes the profile and the next outstanding item surfaces (or the
// banner hides entirely). Adding a new required field is done in
// lib/setupRequirements - this component never needs to change.
// ─────────────────────────────────────────────────────────────
export function SetupPrompt({
  profile, onChanged,
}: { profile: SetupProfile | null; onChanged: () => void }) {
  const { tok, lang } = useI18n();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ar = lang === 'ar';

  const missing = profile ? SETUP_ITEMS.filter((i) => i.isMissing(profile)) : [];
  if (!profile || missing.length === 0) return null;

  const item = missing[0];
  const Icon = item.icon;
  const remaining = missing.length - 1;

  return (
    <>
      <Pressable
        onPress={() => setOpenKey(item.key)}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 4 }}>
          <View style={{
            flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12,
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 10, backgroundColor: tok.elevated,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={tok.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{
                flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8,
              }}>
                <Text style={{
                  color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
                  textAlign: ar ? 'right' : 'left',
                }}>{item.title(lang)}</Text>
                {remaining > 0 && (
                  <Text style={{
                    color: tok.gold, fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 0.5,
                  }}>{`+${remaining}`}</Text>
                )}
              </View>
              <Text style={{
                marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
                textAlign: ar ? 'right' : 'left',
              }}>{item.subtitle(lang)}</Text>
            </View>
            <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 14 }}>
              {ar ? '←' : '→'}
            </Text>
          </View>
        </RCard>
      </Pressable>

      {/* Each outstanding item mounts its own editor; only the open one is
          visible. Saving calls onChanged so the parent refetches the profile. */}
      {missing.map((i) => (
        <Fragment key={i.key}>
          {i.renderSheet({
            visible: openKey === i.key,
            onClose: () => setOpenKey(null),
            onSaved: () => { setOpenKey(null); onChanged(); },
            profile,
          })}
        </Fragment>
      ))}
    </>
  );
}
