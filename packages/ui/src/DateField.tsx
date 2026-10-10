import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Button } from './Button';
import { Text } from './Typography';
import { shadow } from '@nouzl/theme';

/**
 * A tap-to-open date field wrapping `@expo/ui`'s native DateTimePicker —
 * NOT a bare inline `<DateTimePicker>` sitting in the form, which is what
 * every date field in this app used to be (HomeSearchCard's check-in/
 * check-out, reservation/[id].tsx's change-dates) and is exactly what broke
 * on a real Android build:
 *
 * The picker's own docs are explicit that on Android, `presentation`
 * defaults to `'dialog'`, which "opens on mount" and "fires onValueChange
 * on confirmation, onDismiss on cancel — the caller should unmount the
 * component in response." A bare, always-mounted `<DateTimePicker>` never
 * does that unmount: the native dialog pops up the INSTANT the screen
 * renders (before the guest ever asked to pick a date — reported as "I got
 * a calendar to choose a date" just from opening the app), and because the
 * component stays mounted across the confirm/cancel event instead of being
 * torn down and re-created, the dialog is left in an undefined state next
 * time — reported as OK/Cancel doing nothing and the screen "stuck".
 *
 * This component fixes both: the picker only mounts (`open` state) once the
 * guest taps the field, and BOTH `onValueChange` and `onDismiss` set
 * `open` back to false, unmounting it immediately — exactly the lifecycle
 * the docs require. iOS ignores `presentation` and always renders inline,
 * so `open` doubles as "show the inline wheel here" there, with an explicit
 * Done button since there's no native dialog to confirm through.
 */
export interface DateFieldProps {
  label: string;
  value?: Date;
  placeholder: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (date: Date) => void;
  accessibilityLabel?: string;
}

export function DateField({ label, value, placeholder, minimumDate, maximumDate, onChange, accessibilityLabel }: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const initialValue = value ?? minimumDate ?? new Date();

  function confirm(date: Date) {
    onChange(date);
    setOpen(false);
  }

  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-text-secondary">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-row border border-divider bg-card px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        <Text className={value ? 'text-base text-text' : 'text-base text-text-muted'}>
          {value ? formatDate(value, i18n.language) : placeholder}
        </Text>
      </Pressable>

      {open ? (
        <View className="gap-2 rounded-row border border-divider bg-card p-3" style={shadow(2)}>
          <DateTimePicker
            value={initialValue}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            presentation="dialog"
            onValueChange={(_e, date) => confirm(date)}
            onDismiss={() => setOpen(false)}
          />
          {process.env.EXPO_OS === 'ios' ? (
            <Button label={t('common.done')} variant="secondary" onPress={() => confirm(initialValue)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function formatDate(date: Date, language: string): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
