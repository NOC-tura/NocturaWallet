import React, {createContext, useContext, useState, useCallback} from 'react';
import {
  DEFAULT_TRANSPARENT_SCHEME,
  type TransparentScheme,
} from '../modules/keyDerivation/transparent';

interface OnboardingState {
  mnemonic: string | null;
  setMnemonic: (m: string) => void;
  clearMnemonic: () => void;
  isImport: boolean;
  setIsImport: (v: boolean) => void;
  scheme: TransparentScheme;
  setScheme: (s: TransparentScheme) => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

/**
 * Provides shared mnemonic state during onboarding.
 * The mnemonic lives in React state ONLY — never in MMKV or keychain
 * until the Success screen's CTA persists it to keychain.
 *
 * `scheme` is the chosen transparent derivation (default standard SLIP-0010
 * account 0). The import flow may set it from SelectAccountScreen; the create
 * flow leaves it at the default.
 */
export function OnboardingProvider({children}: {children: React.ReactNode}) {
  const [mnemonic, setMnemonicState] = useState<string | null>(null);
  const [isImport, setIsImport] = useState(false);
  const [scheme, setSchemeState] = useState<TransparentScheme>(
    DEFAULT_TRANSPARENT_SCHEME,
  );

  const setMnemonic = useCallback((m: string) => setMnemonicState(m), []);
  const clearMnemonic = useCallback(() => {
    setMnemonicState(null);
    setSchemeState(DEFAULT_TRANSPARENT_SCHEME);
  }, []);
  const setScheme = useCallback((s: TransparentScheme) => setSchemeState(s), []);

  return (
    <OnboardingContext.Provider
      value={{
        mnemonic,
        setMnemonic,
        clearMnemonic,
        isImport,
        setIsImport,
        scheme,
        setScheme,
      }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be inside OnboardingProvider');
  return ctx;
}
