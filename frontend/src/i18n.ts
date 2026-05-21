/**
 * EconoMe — i18n Configuration (Phase 2)
 * Multi-language support for English, Hindi, and Marathi
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import inline translation resources
import { enTranslation, hiTranslation, mrTranslation } from "./locales";

// i18n configuration
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation },
      mr: { translation: mrTranslation },
    },
    fallbackLng: "en",
    defaultNS: "translation",
    debug: false,

    // Language detection options
    detection: {
      order: ["localStorage", "sessionStorage", "navigator"],
      caches: ["localStorage"],
    },

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
      formatSeparator: ",",
    },

    // Namespace configuration
    ns: ["translation"],

    // React options
    react: {
      useSuspense: false, // Disable suspense for now
    },
  });

export default i18n;
