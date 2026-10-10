import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { getLastMode, MODE_HOME, type AppMode } from '@/lib/mode';

/** Opens the app on the mode used last (rider the first time). */
export default function Index() {
  const [mode, setMode] = useState<AppMode | null>(null);

  useEffect(() => {
    void getLastMode().then(setMode);
  }, []);

  if (!mode) return null;
  return <Redirect href={MODE_HOME[mode]} />;
}
