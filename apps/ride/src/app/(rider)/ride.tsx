import { useTranslation } from 'react-i18next';
import { ModeScreen } from '@/components/ModeScreen';

export default function RideScreen() {
  const { t } = useTranslation();
  return (
    <ModeScreen mode="rider" icon="car-outline" title={t('ride.rider.rideTitle')} body={t('ride.rider.rideBody')} />
  );
}
