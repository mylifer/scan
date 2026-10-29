import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'export-exclude-sent:v1';

/** Dışa aktarımda muhasebeciye gönderilmiş fişler hariç tutulsun mu (varsayılan: evet; son seçim hatırlanır) */
export function useExcludeSent(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(true);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (alive && v !== null) setValue(v === '1');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const set = (v: boolean) => {
    setValue(v);
    AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
  };
  return [value, set];
}
