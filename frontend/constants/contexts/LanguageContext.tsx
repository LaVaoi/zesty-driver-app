// contexts/LanguageContext.tsx
// Zesty Driver — bilingual language context (English / Arabic)
// Wraps the entire app; persists selection in AsyncStorage.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { Language, translations, TranslationSchema } from '../translation';

// ─── Storage key ────────────────────────────────────────────────────────────
const LANGUAGE_STORAGE_KEY = '@zesty_driver_language';

// ─── Context shape ──────────────────────────────────────────────────────────
interface LanguageContextValue {
  /** Currently active language code ('en' | 'ar') */
  language: Language;
  /** The full translation object for the active language */
  t: TranslationSchema;
  /** Switch language. Persists to AsyncStorage immediately. */
  setLanguage: (lang: Language) => Promise<void>;
  /** True while the persisted language is being loaded on first mount */
  isLoading: boolean;
  /** Whether the current language is RTL */
  isRTL: boolean;
}

// ─── Context ────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: translations.en,
  setLanguage: async () => {},
  isLoading: true,
  isRTL: false,
});

// ─── Provider ───────────────────────────────────────────────────────────────
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Arabic is RTL; English is LTR
  const isRTL = language === 'ar';

  // ── Load persisted language on first mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'en' || saved === 'ar') {
          setLanguageState(saved);
          // Apply RTL layout direction if needed.
          // NOTE: Full RTL via I18nManager requires an app reload to take
          // effect on the native layer.  We set it here so that on next cold
          // start the layout is correct.  Text alignment is handled per-component
          // via the isRTL flag rather than relying solely on I18nManager.
          applyRTL(saved === 'ar');
        }
      } catch (e) {
        console.warn('[LanguageContext] Failed to load saved language:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Setter ──────────────────────────────────────────────────────────────
  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
      applyRTL(lang === 'ar');
    } catch (e) {
      console.warn('[LanguageContext] Failed to persist language:', e);
      // Still update in-memory even if storage fails
      setLanguageState(lang);
    }
  }, []);

  const value: LanguageContextValue = {
    language,
    t: translations[language],
    setLanguage,
    isLoading,
    isRTL,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// ─── Hook ───────────────────────────────────────────────────────────────────
/**
 * useLanguage()
 *
 * Returns { language, t, setLanguage, isRTL, isLoading }.
 *
 * Example:
 *   const { t, isRTL, setLanguage } = useLanguage();
 *   <Text style={[isRTL && { textAlign: 'right' }]}>{t.common.save}</Text>
 */
export const useLanguage = (): LanguageContextValue => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside <LanguageProvider>');
  }
  return ctx;
};

// ─── RTL helper ─────────────────────────────────────────────────────────────
/**
 * Applies or removes RTL layout direction.
 * Full effect requires app reload on native; text alignment can be driven
 * by isRTL without a reload, which is why we also expose that flag.
 */
function applyRTL(rtl: boolean) {
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    // In an Expo managed workflow you can call Updates.reloadAsync() here
    // if you want instant layout flip after language switch.
    // We deliberately leave that call out so this file has no hard dependency
    // on expo-updates.  Add it in your own app/_layout.tsx if desired.
  }
}

export default LanguageContext;