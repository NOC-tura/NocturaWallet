import React, {useCallback, useRef, useState} from 'react';
import {Pressable, ScrollView, Share, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Check, Copy, Info, Share2} from 'lucide-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {Text} from '../../components/ui';
import {useWalletStore} from '../../store/zustand/walletStore';
import {
  buildReferralLink,
  fetchReferralStats,
} from '../../modules/referral/referralModule';
import {referralStatsDisplay} from '../../modules/referral/referralDisplay';

interface Props {
  onBack?: () => void;
}

/** A single stat card (overline label · balance-md numeral value · caption). */
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 items-center">
      <Text variant="overline" className="mb-2">
        {label}
      </Text>
      <Text
        variant="balance-md"
        numeral
        className={accent ? 'text-accent-transparent' : undefined}>
        {value}
      </Text>
      <Text variant="caption" className="text-fg-tertiary mt-1 text-center">
        {sub}
      </Text>
    </View>
  );
}

export function ReferralScreen({onBack}: Props) {
  const publicKey = useWalletStore(s => s.publicKey);

  const statsQ = useQuery({
    queryKey: ['referralStats', publicKey],
    queryFn: () => fetchReferralStats(publicKey!),
    enabled: publicKey != null,
    staleTime: 60_000,
    retry: 1,
  });

  const display = statsQ.data ? referralStatsDisplay(statsQ.data) : null;
  const link = publicKey ? buildReferralLink(publicKey) : '';

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    if (!link) return;
    Clipboard.setString(link);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    // A referral link isn't sensitive — no clipboard auto-clear, just reset
    // the inline "Copied" confirmation after 2s.
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [link]);

  const handleShare = useCallback(async () => {
    if (!link) return;
    try {
      await Share.share({message: link});
    } catch {
      // user cancelled — not actionable
    }
  }, [link]);

  // Loading / error → values fall back to em-dash. Empty (totalReferrals 0)
  // resolves to '0'/'$0.00' via the display helper, so it renders naturally.
  const referralsVal = display ? display.referrals : '—';
  const earnedVal = display ? display.earnedNoc : '—';
  const referredVal = display ? display.referredUsd : '—';
  const usesCount = display ? display.referrals : '0';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        {onBack && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-12 h-12 items-center justify-center -ml-2">
            <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
          </Pressable>
        )}
        <Text variant="h3" className="ml-1 flex-1">
          Refer a friend
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        showsVerticalScrollIndicator={false}>
        {/* 3-stat hero */}
        <View className="flex-row gap-3 mb-4">
          <StatCard
            label="REFERRALS"
            value={referralsVal}
            sub="total joined"
          />
          <StatCard
            label="EARNED"
            value={earnedVal}
            sub="NOC lifetime"
            accent
          />
          <StatCard
            label="REFERRED"
            value={referredVal}
            sub="from your invites"
          />
        </View>

        {/* Invite-link card */}
        <View className="rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-5 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text variant="overline">YOUR INVITE LINK</Text>
            <Text variant="caption" className="text-fg-tertiary">
              Used{' '}
              <Text variant="caption" numeral className="text-fg-secondary">
                {usesCount}
              </Text>{' '}
              times
            </Text>
          </View>

          <View className="flex-row items-start justify-between rounded-md bg-bg-surface-2 border border-bg-surface-3 px-4 py-3 mb-4">
            {/* Full link shown (not truncated) so it visibly matches the
                website's affiliate link — a referral link isn't sensitive. */}
            <Text variant="body-sm" mono className="flex-1 text-fg-primary mr-3">
              {link}
            </Text>
            <Pressable
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
              className="flex-row items-center min-h-touch-min px-1">
              {copied ? (
                <>
                  <Check size={18} color="#B084FC" strokeWidth={2} />
                  <Text
                    variant="body-sm"
                    className="text-accent-transparent ml-1">
                    Copied
                  </Text>
                </>
              ) : (
                <Copy size={18} color="#A8ACB5" strokeWidth={1.75} />
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share invite link"
            className="flex-row items-center justify-center min-h-touch-min rounded-pill bg-bg-surface-2 border border-bg-surface-3">
            <Share2 size={16} color="#F4F5F7" strokeWidth={1.75} />
            <Text variant="body-sm" className="text-fg-primary ml-2">
              Share invite link
            </Text>
          </Pressable>
        </View>

        {/* Info banner */}
        <View className="flex-row rounded-lg bg-bg-surface-2 p-4 mb-4">
          <View className="mt-px mr-3">
            <Info size={16} color="#A6F0DC" strokeWidth={1.75} />
          </View>
          <Text variant="body-sm" className="flex-1 text-shield-300">
            Earn 10% in NOC when someone buys with your link — up to 30% on
            larger buys.
          </Text>
        </View>

        {/* Legalese */}
        <Text variant="caption" className="text-fg-tertiary">
          Referral payouts are subject to program terms. Self-referrals are
          detected and rejected.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
