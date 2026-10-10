import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState, ScreenTitle } from '@nouzl/ui';
import { ModeSwitch } from '@/components/ModeSwitch';
import type { AppMode } from '@/lib/mode';

/** Placeholder screen for the scaffold: title, mode switch, and an empty state. */
export function ModeScreen({
  mode,
  title,
  body,
  icon,
}: {
  mode: AppMode;
  title: string;
  body: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-page">
      <View className="gap-3 px-5 pt-4">
        <ModeSwitch current={mode} />
        <ScreenTitle title={title} />
      </View>
      <EmptyState icon={icon} title={title} body={body} />
    </SafeAreaView>
  );
}
