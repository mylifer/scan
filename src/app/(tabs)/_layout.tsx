import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';

import { Icon } from '../../components/ui/Icon';
import { WebSidebar } from '../../components/web/WebSidebar';
import { useWide } from '../../lib/layout';
import { fontFamily, useTheme } from '../../lib/theme';

/**
 * Ana gezinme: dört sekme. Her sekmenin kendi sayfa yığını vardır (büyük başlık, arama);
 * fiş, fatura detayı, kamera gibi ekranlar kök yığından sekmenin üstüne açılır ve geri tuşu
 * hep aynı sekmeye döner. Geniş web penceresinde sekmeler soldaki menüye dönüşür.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const wide = useWide();
  return (
    <Tabs
      tabBar={wide ? (props) => <WebSidebar {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        headerShown: false,
        tabBarActiveTintColor: theme.blue,
        tabBarInactiveTintColor: theme.secondaryLabel,
        // Etiket kendi Text'imizle: kütüphanenin web'deki etiket kutusu ş/ç gibi harflerin altını kesiyordu
        tabBarLabel: ({ color, children }) => (
          <Text numberOfLines={1} style={{ fontFamily, fontSize: 11, lineHeight: 14, color, flexShrink: 0 }}>
            {children}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.separator,
          // Web: varsayılan yükseklikte etiketlerin alt kenarı kesiliyordu
          ...(Platform.OS === 'web' ? { height: 64 } : {}),
        },
      }}>
      <Tabs.Screen
        name="(fisler)"
        options={{ title: 'Fişler', tabBarIcon: ({ color }) => <Icon sf="doc.text.fill" ion="receipt-outline" size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="efatura"
        options={{ title: 'e-Faturalar', tabBarIcon: ({ color }) => <Icon sf="doc.richtext.fill" ion="document-text-outline" size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="kdv"
        options={{ title: 'KDV', tabBarIcon: ({ color }) => <Icon sf="percent" ion="calculator-outline" size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Ayarlar', tabBarIcon: ({ color }) => <Icon sf="gearshape.fill" ion="settings-outline" size={24} color={color} /> }}
      />
    </Tabs>
  );
}
