import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function SettingsScreen() {
  const { user, profile, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Profile & App Preferences</Text>
      </View>

      <View style={styles.profileSection}>
        {profile ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.display_name ?? user?.email ?? 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.displayName}>{profile.display_name ?? 'Driver'}</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
        ) : (
          <SkeletonCard />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.btnPressed]}
          onPress={() => signOut()}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  profileSection: {
    marginBottom: Spacing.xl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    padding: Spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentCyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.accentCyan,
  },
  displayName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  email: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  signOutBtn: {
    backgroundColor: Colors.accentRedDim,
    borderColor: Colors.accentRed,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
  signOutText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accentRed,
  },
});
