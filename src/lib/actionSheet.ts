import { ActionSheetIOS, Platform } from 'react-native';

export interface SheetOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface SheetRequest {
  title?: string;
  message?: string;
  options: SheetOption[];
  cancelLabel?: string;
  /** Vazgeç'e basılınca ya da sayfa kapatılınca */
  onCancel?: () => void;
}

type Listener = (req: SheetRequest | null) => void;
const listeners = new Set<Listener>();

/** iOS'ta sistem action sheet'i; diğer platformlarda ActionSheetHost aynı görünümü çizer. */
export function showActionSheet(req: SheetRequest) {
  const cancelLabel = req.cancelLabel ?? 'Vazgeç';
  if (Platform.OS === 'ios') {
    const labels = [...req.options.map((o) => o.label), cancelLabel];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: req.title,
        message: req.message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: req.options.map((o, i) => (o.destructive ? i : -1)).filter((i) => i >= 0),
      },
      (i) => {
        const option = req.options[i];
        if (option) option.onPress();
        else req.onCancel?.();
      },
    );
    return;
  }
  listeners.forEach((l) => l({ ...req, cancelLabel }));
}

export function subscribeActionSheet(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Onay gerektiren yıkıcı işlem (ör. silme) için kısayol. */
export function confirmDestructive(title: string, message: string, actionLabel: string, onConfirm: () => void) {
  showActionSheet({ title, message, options: [{ label: actionLabel, destructive: true, onPress: onConfirm }] });
}
