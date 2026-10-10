import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color } from '@nouzl/theme';
import { Text } from './Typography';
import { EnterUp } from './Motion';
import { Button } from './Button';

/**
 * The "nothing here" and "that went wrong" states, which every screen in
 * both apps previously rendered as a single line of grey text centred in a
 * void. A tinted icon plus a title and a sentence of guidance costs nothing
 * and turns a dead end into something that reads as deliberate — and, where
 * an action exists, offers it directly instead of making the partner find
 * their own way back.
 */
export interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  /** Optional call to action, e.g. "Retry" on an error state. */
  actionLabel?: string;
  onAction?: () => void;
  /** Error states get the danger tint instead of the neutral brand tint. */
  tone?: 'neutral' | 'danger';
  /** Illustration (transparent PNG) shown instead of the tinted icon. */
  image?: ImageSourcePropType;
}

export function EmptyState({ icon = 'file-tray-outline', title, body, actionLabel, onAction, tone = 'neutral', image }: EmptyStateProps) {
  const isDanger = tone === 'danger';
  return (
    <EnterUp className="flex-1 items-center justify-center gap-3 px-8 py-16">
      {image ? (
        <Image source={image} resizeMode="contain" style={{ width: 184, height: 184 }} accessibilityIgnoresInvertColors />
      ) : (
        <View
          className={`h-16 w-16 items-center justify-center rounded-full ${isDanger ? 'bg-danger-tint' : 'bg-brand-tint'}`}
        >
          <Ionicons name={icon} size={28} color={isDanger ? color.status.danger : color.brand.DEFAULT} />
        </View>
      )}
      <Text className="text-center text-base font-bold text-text">{title}</Text>
      {body ? <Text className="text-center text-sm text-text-secondary">{body}</Text> : null}
      {actionLabel && onAction ? (
        <View className="pt-1">
          <Button label={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </EnterUp>
  );
}
