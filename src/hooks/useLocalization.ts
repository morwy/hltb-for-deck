import { useState } from 'react';
import languages from '../languages';

export function resolveLanguage(
    steamLanguage: unknown
): keyof typeof languages {
    if (typeof steamLanguage !== 'string') {
        return 'en';
    }

    const [language, region] = steamLanguage.replace('_', '-').split('-');
    const normalizedLanguage = language.toLowerCase();
    const lang = (
        region
            ? `${normalizedLanguage}${region.charAt(0).toUpperCase()}${region
                  .slice(1)
                  .toLowerCase()}`
            : normalizedLanguage
    ) as keyof typeof languages;
    return languages[lang] ? lang : 'en';
}

export function getCurrentLanguage(): keyof typeof languages {
    try {
        return resolveLanguage(
            window.LocalizationManager?.m_rgLocalesToUse?.[0]
        );
    } catch {
        return 'en';
    }
}

export function localize(
    key: keyof typeof languages['en'],
    language = getCurrentLanguage()
): string {
    return languages[language]?.[key] || languages.en[key] || key;
}

export default function useLocalization() {
    const [language] = useState(getCurrentLanguage());
    return function (key: keyof typeof languages['en']): string {
        return localize(key, language);
    };
}
