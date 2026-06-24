import React from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Check,
  FileText,
  Globe,
  Landmark,
  Lock,
  X,
} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {regionDisplay} from '../../modules/geoFence/regionDisplay';

interface Props {
  /** Coarse IP-derived ISO-3166 alpha-2 region; undefined → "UNKNOWN". */
  countryCode?: string;
  /**
   * Whether the NOC presale is ACTUALLY blocked for this region (OFAC-sanctioned).
   * Drives region-accuracy: when false (e.g. an EU user who reached this screen
   * via the informational link), presale is shown as available — never falsely
   * claimed as geofenced. Defaults to false.
   */
  presaleBlocked?: boolean;
  /** Sticky [Got it] — back to the trigger screen (presale / swap). */
  onDismiss: () => void;
  /** Header X — back to the dashboard root. */
  onClose: () => void;
}

/** One reason row: a tinted icon tile + title + sub-caption. */
function ReasonRow({
  icon,
  title,
  sub,
  divider,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  divider?: boolean;
}) {
  return (
    <View
      className={`flex-row items-start gap-3 px-4 py-3 ${
        divider ? 'border-t border-bg-surface-3' : ''
      }`}>
      <View className="w-9 h-9 rounded-md bg-info/12 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1 min-w-0">
        <Text variant="body" className="text-fg-primary">
          {title}
        </Text>
        <Text variant="caption" className="text-fg-tertiary mt-0.5">
          {sub}
        </Text>
      </View>
    </View>
  );
}

/** A single "what still works" bullet (mint check + label). */
function WorksItem({label}: {label: string}) {
  return (
    <View className="flex-row items-center gap-2 w-1/2 mb-1">
      <Check size={14} color="#3FD68B" strokeWidth={2.5} />
      <Text variant="body-sm" className="text-fg-primary">
        {label}
      </Text>
    </View>
  );
}

/**
 * #50 · geo-blocked — region-restricted action takeover.
 *
 * Honest, mode-agnostic compliance screen reached when the user's coarse-IP
 * region maps to a blocked operation (presale #23 / swap #28) OR via the
 * informational "Not available in your region?" link. The reason rows are
 * REGION-ACCURATE: only what actually applies to this region is listed —
 * presale appears as restricted only when truly geofenced (OFAC-sanctioned),
 * otherwise it's listed under "what still works". Swaps are EU-MiCA only.
 * Coarse-geo: IP-derived, no GPS / device location. Pure props; no network.
 */
export function GeoBlockedScreen({
  countryCode,
  presaleBlocked = false,
  onDismiss,
  onClose,
}: Props) {
  const {label, isEu} = regionDisplay(countryCode ?? 'UNKNOWN');
  const regionLine = `${label}${isEu ? ' · EU' : ''}`;

  // Only surface restrictions that actually apply to this region.
  const reasons: {icon: React.ReactNode; title: string; sub: string}[] = [];
  if (isEu) {
    reasons.push({
      icon: <FileText size={18} color="#7DA8FF" strokeWidth={1.75} />,
      title: 'Token swaps',
      sub: 'Not available under EU MiCA',
    });
  }
  if (presaleBlocked) {
    reasons.push({
      icon: <Lock size={18} color="#7DA8FF" strokeWidth={1.75} />,
      title: 'NOC presale',
      sub: 'Geofenced in your region',
    });
  }
  reasons.push({
    icon: <Landmark size={18} color="#7DA8FF" strokeWidth={1.75} />,
    title: 'Fiat on-ramp',
    sub: 'Licensing pending',
  });

  // Presale is available everywhere EXCEPT sanctioned regions, so list it under
  // "what still works" whenever it isn't blocked.
  const works = ['Send', 'Receive', 'Stake'];
  if (!presaleBlocked) {
    works.push('NOC presale');
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar — title + X (→ dashboard) */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Text variant="h3" className="flex-1 ml-1">
          Not available here
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="w-12 h-12 items-center justify-center -mr-2">
          <X size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}>
        {/* Hero — info glyph + honest headline + copy */}
        <View className="items-center gap-3 px-5 pt-6 pb-5">
          <View className="w-[72px] h-[72px] rounded-full bg-info/12 border border-info/32 items-center justify-center">
            <Globe size={32} color="#7DA8FF" strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-center">
            Some features aren't available in your region right now
          </Text>
          <Text
            variant="body"
            className="text-fg-secondary text-center max-w-[280px]">
            Some operations are restricted by jurisdiction. The rest of your
            wallet works as usual.
          </Text>
        </View>

        {/* Detected region + coarse-geo disclosure */}
        <View className="mx-4 mb-4 px-5 py-4 rounded-lg bg-bg-surface-1">
          <View className="flex-row items-baseline gap-1">
            <Text variant="caption" className="text-fg-tertiary">
              Detected region:
            </Text>
            <Text variant="body" className="text-fg-primary">
              {regionLine}
            </Text>
          </View>
          <Text variant="caption" className="text-fg-tertiary mt-0.5">
            Based on your network — no GPS, no device location.
          </Text>
        </View>

        {/* Region-accurate reason rows */}
        <View className="mx-5 mb-4 rounded-lg bg-bg-surface-1 border border-bg-surface-3 overflow-hidden">
          {reasons.map((r, i) => (
            <ReasonRow
              key={r.title}
              icon={r.icon}
              title={r.title}
              sub={r.sub}
              divider={i > 0}
            />
          ))}
        </View>

        {/* What still works */}
        <View className="mx-4 px-5 py-4 rounded-lg bg-success/8 border border-success/24">
          <View className="flex-row items-center gap-2 mb-3">
            <Check size={18} color="#3FD68B" strokeWidth={2.5} />
            <Text variant="overline" className="text-success">
              What still works
            </Text>
          </View>
          <View className="flex-row flex-wrap">
            {works.map(w => (
              <WorksItem key={w} label={w} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom — [Got it] → back to trigger screen */}
      <View className="px-5 pt-3 pb-5 bg-bg-base border-t border-bg-surface-2">
        <Button label="Got it" onPress={onDismiss} />
      </View>
    </SafeAreaView>
  );
}
