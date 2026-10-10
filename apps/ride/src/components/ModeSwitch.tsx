import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Chip } from '@nouzl/ui';
import { MODE_HOME, setLastMode, type AppMode } from '@/lib/mode';

/**
 * Switches between rider and captain mode and remembers the choice. Captain
 * mode is open to everyone in this shell; locking it until onboarding is
 * approved (backend enforced, spec 0001) arrives with feature 7, and blocking
 * the switch while online or on a ride arrives with feature 6.
 */
export function ModeSwitch({ current }: { current: AppMode }) {
  const { t } = useTranslation();

  function choose(mode: AppMode) {
    if (mode === current) return;
    void setLastMode(mode);
    router.replace(MODE_HOME[mode]);
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('ride.mode.label')} className="flex-row gap-2">
      <Chip
        label={t('ride.mode.rider')}
        selected={current === 'rider'}
        onPress={() => choose('rider')}
        accessibilityRole="radio"
        accessibilityState={{ selected: current === 'rider' }}
      />
      <Chip
        label={t('ride.mode.captain')}
        selected={current === 'captain'}
        onPress={() => choose('captain')}
        accessibilityRole="radio"
        accessibilityState={{ selected: current === 'captain' }}
      />
    </View>
  );
}
