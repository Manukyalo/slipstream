import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return null;
  }

  // Directly land on the feature tabs (Track screen) regardless of auth status
  return <Redirect href="/(tabs)/track" />;
}
