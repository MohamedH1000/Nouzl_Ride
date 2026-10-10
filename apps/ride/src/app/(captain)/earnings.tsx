import { useTranslation } from 'react-i18next';
import { ModeScreen } from '@/components/ModeScreen';

export default function EarningsScreen() {
  const { t } = useTranslation();
  return <ModeScreen mode="captain" icon="wallet-outline" title={t('ride.captain.earningsTitle')} body={t('ride.captain.earningsEmpty')} />;
}
