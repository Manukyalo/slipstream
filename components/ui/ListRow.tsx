/**
 * ListRow — standard list item
 *
 * Left:   optional IconChip + label + optional sublabel
 * Right:  optional value text + optional chevron
 * Bottom: 1px hairline divider (hidden when isLast=true)
 *
 * Usage:
 *   <ListRow
 *     icon="gear"
 *     iconColor="default"
 *     label="Notifications"
 *     sublabel="Push alerts for radar zones"
 *     rightValue="On"
 *     chevron
 *     onPress={handlePress}
 *   />
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { IconChip, type IconChipColor } from './IconChip';
import { Icon } from './Icon';
import { Text } from './Text';
import type { IconName } from './Icon';

interface ListRowProps {
  label: string;
  sublabel?: string;
  icon?: IconName;
  iconColor?: IconChipColor;
  rightValue?: string;
  /** Show a chevron arrow on the right */
  chevron?: boolean;
  /** Right side custom element (overrides rightValue + chevron) */
  rightSlot?: React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  /** If true, label renders in danger red */
  destructive?: boolean;
}

export function ListRow({
  label,
  sublabel,
  icon,
  iconColor = 'default',
  rightValue,
  chevron = false,
  rightSlot,
  isLast = false,
  onPress,
  style,
  destructive = false,
}: ListRowProps) {
  async function handlePress() {
    if (!onPress) return;
    await Haptics.selectionAsync();
    onPress();
  }

  const labelColor = destructive ? Colors.semantic.danger : Colors.text.primary;

  const content = (
    <View style={[styles.row, !isLast && styles.divider, style]}>
      {/* Left */}
      <View style={styles.left}>
        {icon && (
          <IconChip name={icon} color={iconColor} chipSize={36} size={18} />
        )}
        <View style={styles.labelBlock}>
          <Text variant="body" color={labelColor} style={styles.labelText}>
            {label}
          </Text>
          {sublabel && (
            <Text variant="label" color={Colors.text.tertiary}>
              {sublabel}
            </Text>
          )}
        </View>
      </View>

      {/* Right */}
      <View style={styles.right}>
        {rightSlot ?? (
          <>
            {rightValue && (
              <Text variant="label" color={Colors.text.secondary}>
                {rightValue}
              </Text>
            )}
            {chevron && (
              <Icon name="caret-right" size={16} color={Colors.text.tertiary} />
            )}
          </>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[3],
    gap:            Spacing[3],
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[3],
    flex:          1,
  },
  labelBlock: {
    flex: 1,
    gap:  2,
  },
  labelText: {
    fontSize: 15,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing[2],
  },
});
