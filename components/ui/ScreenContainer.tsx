/**
 * ScreenContainer — base wrapper for every screen
 *
 * Provides:
 *  - bg.base background
 *  - SafeAreaView top + bottom insets (never hard-coded offsets)
 *  - Optional large collapsing title (shrinks on scroll)
 *  - Optional ScrollView wrapping
 *
 * Usage:
 *   // Non-scrolling screen (map, real-time data)
 *   <ScreenContainer>
 *     <YourContent />
 *   </ScreenContainer>
 *
 *   // Scrolling screen with header
 *   <ScreenContainer scrollable title="Favorite Roads">
 *     <YourContent />
 *   </ScreenContainer>
 *
 *   // Scrolling screen with collapsing large title
 *   <ScreenContainer scrollable title="Rankings" largeTitle>
 *     <YourContent />
 *   </ScreenContainer>
 */

import React, { useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '@/constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Wraps children in a ScrollView */
  scrollable?: boolean;
  /** Screen title — shown in the header bar */
  title?: string;
  /** If true, title starts large and collapses on scroll */
  largeTitle?: boolean;
  /** Rendered to the right of the title bar */
  headerRight?: React.ReactNode;
  /** Rendered to the left of the title bar (e.g. Back/Cancel) */
  headerLeft?: React.ReactNode;
  /** Custom element in the center of header */
  headerCenter?: React.ReactNode;
  /** Subtitle shown below title */
  subtitle?: string;
  /** Extra style for the inner content container */
  contentStyle?: ViewStyle;
  /** Forwarded to ScrollView when scrollable=true */
  scrollViewProps?: Omit<ScrollViewProps, 'children'>;
  /** Omit safe area top inset if already applied by a parent container */
  skipTopInset?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SMALL_TITLE_TRIGGER = 40; // scroll offset at which title collapses

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ScreenContainer({
  children,
  scrollable = false,
  title,
  largeTitle = false,
  headerRight,
  headerLeft,
  headerCenter,
  subtitle,
  contentStyle,
  scrollViewProps,
  skipTopInset = false,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));

  // Large title opacity: fades out as user scrolls past the trigger
  const largeTitleOpacity = largeTitle
    ? scrollY.interpolate({
        inputRange:  [0, SMALL_TITLE_TRIGGER],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
    : null;

  // Small header title opacity: fades in as large title fades out
  const smallTitleOpacity = largeTitle
    ? scrollY.interpolate({
        inputRange:  [SMALL_TITLE_TRIGGER * 0.6, SMALL_TITLE_TRIGGER],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : null;

  const hasHeader = Boolean(title || headerLeft || headerRight || headerCenter);

  return (
    <View style={[styles.root, { backgroundColor: Colors.bg.base }]}>
      {/* ── Sticky header (always visible, clears status bar via inset) ── */}
      {hasHeader && (
        <View
          style={[
            styles.header,
            {
              paddingTop:          (skipTopInset ? 0 : insets.top) + 12,
              paddingHorizontal:   Spacing.screen,
              borderBottomColor:   Colors.hairline,
            },
          ]}
        >
          {/* Header row */}
          <View style={styles.headerRow}>
            {headerLeft && <View style={styles.headerLeft}>{headerLeft}</View>}

            {headerCenter ? (
              <View style={styles.headerCenterWrap}>{headerCenter}</View>
            ) : (
              <View style={[styles.titleWrap, Boolean(headerLeft) && styles.titleWrapWithLeft]}>
                {largeTitle && smallTitleOpacity ? (
                  <Animated.Text
                    style={[styles.smallTitle, { opacity: smallTitleOpacity }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Animated.Text>
                ) : title ? (
                  <Animated.Text style={styles.smallTitle} numberOfLines={1}>
                    {title}
                  </Animated.Text>
                ) : null}

                {subtitle && (
                  <Animated.Text style={styles.headerSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Animated.Text>
                )}
              </View>
            )}

            {headerRight ? (
              <View style={styles.headerRight}>{headerRight}</View>
            ) : headerLeft ? (
              <View style={styles.headerRightSpacer} />
            ) : null}
          </View>
        </View>
      )}

      {/* ── Content ── */}
      {scrollable ? (
        <Animated.ScrollView
          {...scrollViewProps}
          onScroll={
            largeTitle
              ? Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: true },
                )
              : scrollViewProps?.onScroll
          }
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.section },
            contentStyle,
          ]}
        >
          {/* Large title block — collapses on scroll */}
          {title && largeTitle && largeTitleOpacity && (
            <Animated.Text
              style={[styles.largeTitle, { opacity: largeTitleOpacity }]}
              numberOfLines={1}
            >
              {title}
            </Animated.Text>
          )}
          {children}
        </Animated.ScrollView>
      ) : (
        <View
          style={[
            styles.fixedContent,
            { paddingBottom: insets.bottom },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 0, // Transparent by default; add 1 via prop if needed
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingBottom:  12,
  },
  smallTitle: {
    ...Typography.heading,
    color:  Colors.text.primary,
  },
  headerLeft: {
    marginRight: Spacing.gap,
    minWidth: 44,
    alignItems: 'flex-start',
  },
  headerCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  titleWrapWithLeft: {
    alignItems: 'center',
  },
  headerSubtitle: {
    ...Typography.label,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  headerRight: {
    marginLeft: Spacing.gap,
    minWidth: 44,
    alignItems: 'flex-end',
  },
  headerRightSpacer: {
    minWidth: 44,
  },
  largeTitle: {
    ...Typography.title,
    color:          Colors.text.primary,
    paddingHorizontal: Spacing.screen,
    paddingTop:     Spacing[2],
    paddingBottom:  Spacing[4],
  },
  scrollContent: {
    flexGrow: 1,
  },
  fixedContent: {
    flex: 1,
  },
});
