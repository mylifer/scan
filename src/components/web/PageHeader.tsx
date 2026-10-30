import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fontFamily, useShadcnTheme } from '../../lib/theme';
import { WebButton } from './Button';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shadcn UI Web Sayfa Başlığı bileşeni.
 */
export function WebPageHeader({ title, description, badge, actions, onBack, backLabel, style }: PageHeaderProps) {
  const t = useShadcnTheme();

  return (
    <View style={[styles.header, style]}>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          {onBack && (
            <WebButton
              variant="ghost"
              size="sm"
              icon={{ sf: 'chevron.left', ion: 'arrow-back' }}
              onPress={onBack}
              style={{ marginRight: 4, height: 32, paddingHorizontal: 8 }}>
              {backLabel ?? 'Geri'}
            </WebButton>
          )}
          <Text style={[styles.title, { color: t.foreground }]}>{title}</Text>
          {badge}
        </View>
        {description ? <Text style={[styles.description, { color: t.mutedForeground }]}>{description}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  textWrap: {
    gap: 4,
    flex: 1,
    minWidth: 240,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  description: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
});
