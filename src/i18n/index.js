import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.js';
import en from './locales/en.js';
import ko from './locales/ko.js';

const getInitialLanguage = () => {
  const savedLanguage = localStorage.getItem('appLanguage');
  if (savedLanguage) return savedLanguage;
  
  // Detect browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.includes('ru')) return 'ru';
    if (browserLang.includes('en')) return 'en';
    if (browserLang.includes('ko')) return 'ko';
  }
  
  // Default to Korean for PG review bots / unknown
  return 'ko';
};

const initialLanguage = getInitialLanguage();
i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      ko: { translation: ko }
    },
    lng: initialLanguage,
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
