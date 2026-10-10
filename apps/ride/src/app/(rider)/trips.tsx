import { useTranslation } from 'react-i18next';
import { ModeScreen } from '@/components/ModeScreen';

export default function TripsScreen() {
  const { t } = useTranslation();
  return (
    <ModeScreen mode="rider" icon="time-outline" title={t('ride.rider.tripsTitle')} body={t('ride.rider.tripsEmpty')} />
  );
}
