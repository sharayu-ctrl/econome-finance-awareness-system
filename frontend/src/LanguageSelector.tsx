/**
 * EconoMe — Language Selector Component (Phase 2)
 * Dropdown component for switching between languages
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = "" }) => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    // Persist selection to localStorage
    localStorage.setItem('preferredLanguage', langCode);
  };

  return (
    <div className={`language-selector ${className}`}>
      <div className="relative inline-block text-left">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition cursor-pointer">
          <span className="text-lg">{currentLanguage.flag}</span>
          <select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-transparent font-medium text-sm focus:outline-none cursor-pointer"
            aria-label="Select language"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
