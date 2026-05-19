import React, {useEffect, useMemo, useState} from 'react';
import {View, Pressable, TextInput, FlatList} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Plus, Search, X, Users} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import type {Contact} from '../../modules/addressBook/types';
import {cn} from '../../utils/cn';

/**
 * #15 Address book — Phase B migration · mirror /home/user/Downloads/index.html §s15
 *
 * Three states (auto-switching based on data + query):
 *   - empty       — no contacts saved, hero with Users icon + "Add first contact" CTA
 *   - populated   — sorted list of contacts (most-recently-used first)
 *   - search-active — filtered list with substring match + count eyebrow + "no more matches" footer
 *
 * Layout:
 *   - Top bar: back · "Address book" title · "+ Add contact" (accent · top-right)
 *   - Search field (Lucide Search icon + TextInput + Clear-X when query > 0)
 *   - List (FlatList; design suggests FlashList for 60 fps but RN FlatList is sufficient at typical contact counts)
 *
 * Contact row (≥ 64 dp):
 *   - 40 dp colored avatar pill (deterministic color from name hash)
 *   - Name (body-lg) above truncated mono address (body-sm, 6+4 chars)
 *   - Relative date right-aligned (body-sm · fg-tertiary)
 *
 * On row tap:
 *   - If pending contact selection (from Send screen) → resolve + close
 *   - Else → close (standalone view; tx-detail navigation deferred to #27)
 *
 * "+ Add contact" CTA opens nothing yet — add-contact sheet deferred to #15.2
 * (per design baseline note "placeholder per spec — not in this section's
 * scope"). For now shows an Alert with manual instruction.
 */

interface AddressBookScreenProps {
  onBack: () => void;
  onSelect?: (contact: Contact) => void;
  onAddContact?: () => void;
}

// 6 brand-ish hues for avatar backgrounds · deterministic mapping by first letter
const AVATAR_PALETTE: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#1B142C', fg: '#B084FC'}, // violet
  {bg: '#0E2620', fg: '#5BE3C2'}, // mint
  {bg: '#2A1518', fg: '#FF8B95'}, // coral
  {bg: '#2A2010', fg: '#F2B53B'}, // amber
  {bg: '#0E1A2E', fg: '#7DA8FF'}, // blue
  {bg: '#1F1A2E', fg: '#A38BFA'}, // indigo
];

function getAvatarPalette(name: string): {bg: string; fg: string} {
  if (!name) return AVATAR_PALETTE[0];
  const idx = name.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function relativeDate(timestamp?: number): string {
  if (!timestamp) return 'never';
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'last month';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
}

function highlightMatch(name: string, query: string): React.ReactNode {
  if (!query) return name;
  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerName.indexOf(lowerQuery);
  if (idx < 0) return name;
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + query.length);
  const after = name.slice(idx + query.length);
  return (
    <>
      {before}
      <Text variant="body-lg" className="text-accent-transparent font-geist-semibold">
        {match}
      </Text>
      {after}
    </>
  );
}

export function AddressBookScreen({onBack, onSelect, onAddContact}: AddressBookScreenProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      setContacts(addressBook.getContacts());
    } catch {
      setContacts([]);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const lower = query.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.address.toLowerCase().includes(lower),
    );
  }, [contacts, query]);

  const isEmpty = contacts.length === 0;
  const hasQuery = query.trim().length > 0;

  const handleSelect = (contact: Contact) => {
    onSelect?.(contact);
  };

  const handleAddContact = () => {
    onAddContact?.();
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3 min-h-touch-min">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 items-center justify-center -ml-2">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <Text variant="h1" className="ml-1 flex-1">
          Address book
        </Text>
        <Pressable
          onPress={handleAddContact}
          accessibilityRole="button"
          accessibilityLabel="Add contact"
          className="w-12 h-12 items-center justify-center -mr-2">
          <Plus size={22} color="#B084FC" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Search field */}
      {!isEmpty || hasQuery ? (
        <View className="px-5 mb-2">
          <View className="flex-row items-center gap-2 bg-bg-surface-1 border border-bg-surface-3 rounded-md px-3 py-2">
            <Search
              size={18}
              color={hasQuery ? '#B084FC' : '#6E727A'}
              strokeWidth={1.75}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search contacts"
              placeholderTextColor="#6E727A"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search contacts"
              className="flex-1 font-geist text-body text-fg-primary"
              style={{minHeight: 22}}
            />
            {hasQuery ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                className="w-8 h-8 items-center justify-center rounded-pill -mr-1 active:bg-bg-surface-2">
                <X size={14} color="#A8ACB5" strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {isEmpty ? (
        <EmptyState onAddContact={handleAddContact} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{paddingBottom: 24}}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            hasQuery ? (
              <Text variant="overline" className="text-fg-tertiary px-5 py-2">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'} for "{query}"
              </Text>
            ) : null
          }
          ListFooterComponent={
            hasQuery ? (
              <NoMoreMatchesFooter
                query={query}
                onAdd={handleAddContact}
              />
            ) : null
          }
          renderItem={({item}) => (
            <ContactRow
              contact={item}
              query={query}
              onPress={() => handleSelect(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Contact row ────────────────────────────────────────────────────────────

interface ContactRowProps {
  contact: Contact;
  query: string;
  onPress: () => void;
}

function ContactRow({contact, query, onPress}: ContactRowProps) {
  const palette = getAvatarPalette(contact.name);
  const initial = (contact.name.charAt(0) || '?').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${truncateAddress(contact.address)}`}
      testID="contact-row"
      className="flex-row items-center px-5 py-3 active:bg-bg-surface-1 min-h-touch-lg">
      <View
        className="w-10 h-10 rounded-pill items-center justify-center mr-3"
        style={{backgroundColor: palette.bg}}>
        <Text
          variant="body-lg"
          className="font-geist-semibold"
          style={{color: palette.fg}}>
          {initial}
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="body-lg" className="text-fg-primary" numberOfLines={1}>
          {highlightMatch(contact.name, query)}
        </Text>
        <Text variant="body-sm" mono className="text-fg-secondary mt-0.5" numberOfLines={1}>
          {truncateAddress(contact.address)}
        </Text>
      </View>
      <Text variant="body-sm" className="text-fg-tertiary ml-2">
        {relativeDate(contact.lastUsedAt)}
      </Text>
    </Pressable>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onAddContact: () => void;
}

function EmptyState({onAddContact}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-20 h-20 rounded-icon-hero bg-accent-transparent-tint items-center justify-center mb-5">
        <Users size={36} color="#B084FC" strokeWidth={1.5} />
      </View>
      <Text variant="h3" className="text-center mb-2">
        No saved contacts yet
      </Text>
      <Text variant="body-sm" className="text-center text-fg-secondary max-w-sm mb-6">
        Save aliases for the wallets you send to most often. Each one shows up
        here with the truncated address and last-sent date.
      </Text>
      <Pressable
        onPress={onAddContact}
        accessibilityRole="button"
        className="min-h-touch-rec px-7 rounded-pill bg-accent-transparent items-center justify-center flex-row gap-2 active:opacity-90">
        <Plus size={18} color="#0A0A0A" strokeWidth={2} />
        <Text variant="body-lg" className="font-geist-semibold text-bg-base">
          Add first contact
        </Text>
      </Pressable>
      <Text variant="caption" className={cn('text-fg-tertiary mt-3 text-center')}>
        Or save from a transaction detail
      </Text>
    </View>
  );
}

// ── "No more matches" footer (search-active state) ─────────────────────────

interface NoMoreMatchesFooterProps {
  query: string;
  onAdd: () => void;
}

function NoMoreMatchesFooter({query, onAdd}: NoMoreMatchesFooterProps) {
  return (
    <View className="px-5 py-6 items-center">
      <Text variant="body-sm" className="text-fg-tertiary text-center mb-3">
        No more matches.
      </Text>
      <Button
        label={`Add new contact "${query}"  →`}
        variant="tertiary"
        onPress={onAdd}
      />
    </View>
  );
}
