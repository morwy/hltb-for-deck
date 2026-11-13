import languages from '../languages';

export type LocalizationKey = keyof typeof languages['en'];

function getCurrentLanguage(): keyof typeof languages {
    const steamLang = window.LocalizationManager.m_rgLocalesToUse[0];
    const lang = steamLang.replace(/-([a-z])/g, (_, letter: string) =>
        letter.toUpperCase()
    ) as keyof typeof languages;
    return languages[lang] ? lang : 'en';
}

// Usable anywhere, including code outside React components such as the store
// page patch. Falls back to English, then to the key itself.
export function translate(key: LocalizationKey): string {
    const lang = getCurrentLanguage();
    if (languages[lang]?.[key]?.length) {
        return languages[lang]?.[key];
    } else if (languages.en?.[key]?.length) {
        return languages.en?.[key];
    } else {
        return key;
    }
}

export default function useLocalization() {
    return translate;
}
