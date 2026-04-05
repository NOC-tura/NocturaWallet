import React, {createContext, useContext, useState, useCallback} from 'react';

interface OnboardingState {
  mnemonic: string | null;
  setMnemonic: (m: string) => void;
  clearMnemonic: () => void;
  isImport: boolean;
  setIsImport: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

/**
 * Provides shared mnemonic state during onboarding.
 * The mnemonic lives in React state ONLY — never in MMKV or keychain
 * until the Success screen's CTA persists it to keychain.
 */
export function OnboardingProvider({children}: {children: React.ReactNode}) {
  const [mnemonic, setMnemonicState] = useState<string | null>(null);
  const [isImport, setIsImport] = useState(false);

  const setMnemonic = useCallback((m: string) => setMnemonicState(m), []);
  const clearMnemonic = useCallback(() => setMnemonicState(null), []);

  return (
    <OnboardingContext.Provider
      value={{mnemonic, setMnemonic, clearMnemonic, isImport, setIsImport}}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be inside OnboardingProvider');
  return ctx;
}
