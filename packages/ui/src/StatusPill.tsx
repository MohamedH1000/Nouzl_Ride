import React from 'react';
import { View } from 'react-native';
import { Text } from './Typography';

/**
 * The booking-status chip. The exact same tone table was written out by hand
 * in the business app's bookings list, the customer app's trips list, and
 * again in the customer app's reservation detail screen — three copies that
 * had already drifted apart in padding and text size.
 *
 * Takes a resolved `label` rather than a status string on purpose: the two
 * apps look the same status up under different i18n namespaces
 * (`partner.bookings.*` vs `reservation.*`), so the lookup stays with the
 * caller and only the presentation lives here.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  neutral: 'bg-page text-text-secondary',
};

/** Shared status→tone mapping. Both apps recognise the same booking
 *  statuses, including the customer-only `payment-pending`. */
export function statusTone(status: string | null | undefined): StatusTone {
  if (status === 'confirmed' || status === 'accepted' || status === 'completed') return 'success';
  if (status === 'deposit' || status === 'pending' || status === 'payment-pending') return 'warning';
  if (status === 'cancelled' || status === 'noattend') return 'danger';
  return 'neutral';
}

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const classes = TONE_CLASSES[tone];
  const [bg, text] = classes.split(' ');
  return (
    <View className={`rounded-chip px-2.5 py-1 ${bg}`}>
      <Text className={`text-center text-[10px] font-bold ${text}`}>{label}</Text>
    </View>
  );
}
