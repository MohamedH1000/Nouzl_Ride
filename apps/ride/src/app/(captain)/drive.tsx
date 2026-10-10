import { useTranslation } from 'react-i18next';
import { ModeScreen } from '@/components/ModeScreen';

export default function DriveScreen() {
  const { t } = useTranslation();
  return <ModeScreen mode="captain" icon="speedometer-outline" title={t('ride.captain.driveTitle')} body={t('ride.captain.driveBody')} />;
}
