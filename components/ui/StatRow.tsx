import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface StatRowProps {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  value: string | number;
  unit?: string;
  isLast?: boolean;
  valueColor?: string;
  subValue?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function StatRow({
  icon: Icon,
  iconColor = '#7B8493',
  label,
  value,
  unit,
  isLast = false,
  valueColor = '#EDEFF3',
  subValue,
  style,
}: StatRowProps) {
  return (
    <View style={[styles.statRow, !isLast && styles.hairlineDivider, style]}>
      <View style={styles.statRowLeft}>
        {Icon && (
          <View style={styles.statRowIconWrapper}>
            <Icon size={16} strokeWidth={1.5} color={iconColor} />
          </View>
        )}
        <Text style={styles.statRowLabel}>{label}</Text>
      </View>

      <View style={styles.statRowRight}>
        <View style={styles.valueRow}>
          <Text style={[styles.statRowValue, { color: valueColor }]}>{value}</Text>
          {unit && <Text style={styles.statRowUnit}>{unit}</Text>}
        </View>
        {subValue && <Text style={styles.statRowSubValue}>{subValue}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  hairlineDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#1D242C',
  },
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statRowIconWrapper: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRowLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#7B8493',
  },
  statRowRight: {
    alignItems: 'flex-end',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statRowValue: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 16,
  },
  statRowUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#7B8493',
  },
  statRowSubValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#7B8493',
    marginTop: 2,
  },
});
