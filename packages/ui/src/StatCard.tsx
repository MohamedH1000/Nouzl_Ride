import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color } from '@nouzl/theme';
import { Text } from './Typography';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

/**
 * A KPI tile. The business dashboard's own version was a bare value+label
 * stack with no icon and no visual anchor, so four of them in a 2x2 grid
 * read as an undifferentiated wall of numbers. A tinted icon chip gives
 * each tile an identity you can find at a glance, which is the whole point
 * of a dashboard a partner checks in three seconds between guests.
 *
 * `tone` maps to the theme's status colours rather than accepting a raw
 * colour, keeping these tiles inside the same palette as the status pills
 * they sit next to.
 */
export type StatTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<StatTone, { chip: string; icon: string }> = {
  brand: { chip: 'bg-brand-tint', icon: color.brand.DEFAULT },
  success: { chip: 'bg-success-tint', icon: color.status.success },
  warning: { chip: 'bg-warning-tint', icon: color.status.warning },
  danger: { chip: 'bg-danger-tint', icon: color.status.danger },
  info: { chip: 'bg-accent-blue-tint', icon: color.accentBlue.DEFAULT },
};

export interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: StatTone;
  /** Renders a shimmer in place of the value while the figure loads. */
  loading?: boolean;
}

export function StatCard({ label, value, icon, tone = 'brand', loading }: StatCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <Card className="flex-1 gap-2" level={2}>
      {icon ? (
        <View className={`h-9 w-9 items-center justify-center rounded-chip ${styles.chip}`}>
          <Ionicons name={icon} size={18} color={styles.icon} />
        </View>
      ) : null}
      {loading ? (
        <Skeleton className="w-2/3" height={24} />
      ) : (
        // numberOfLines guards a long localized currency figure from
        // reflowing the tile and breaking the 2-up grid alignment.
        <Text className="text-2xl font-extrabold text-brand" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      )}
      <Text className="text-xs text-text-secondary" numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}
