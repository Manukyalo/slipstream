/**
 * GlobalErrorBoundary — Catches unhandled JS runtime crashes in Slipstream
 *
 * Requirements:
 *  - Traps render tree errors and surfaces friendly UI via toUserMessage()
 *  - Logs error and component stack trace for observability
 *  - Provides "Try again" to reset component state and "Restart app" via expo-updates
 *  - Styled with canonical theme tokens (#05070D, Space Grotesk, Inter, Button)
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { Colors, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { IconChip } from '@/components/ui/IconChip';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { toUserMessage } from '@/utils/toUserMessage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production, log to Sentry / error tracking service
    console.error('[GlobalErrorBoundary] Caught unhandled exception:', error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      this.handleReset();
    }
  };

  override render() {
    if (this.state.hasError) {
      const friendlyMessage = toUserMessage(this.state.error);

      return (
        <ScreenContainer title="Slipstream">
          <View style={styles.content}>
            <IconChip name="warning" color="danger" chipSize={64} size={32} />

            <View style={styles.textWrap}>
              <Text variant="heading" centered>
                Something went wrong
              </Text>
              <Text variant="body" color={Colors.text.secondary} centered style={styles.body}>
                {friendlyMessage}
              </Text>
            </View>

            <View style={styles.actions}>
              <Button variant="primary" onPress={this.handleReset}>
                Try again
              </Button>
              <Button variant="secondary" onPress={this.handleReload}>
                Restart application
              </Button>
            </View>
          </View>
        </ScreenContainer>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screen,
    gap: Spacing[6],
  },
  textWrap: {
    alignItems: 'center',
    gap: Spacing[2],
    maxWidth: 320,
  },
  body: {
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: Spacing[3],
    marginTop: Spacing[2],
  },
});
