export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR',
  IT: 'EUR', ES: 'EUR', AU: 'AUD', CA: 'CAD', JP: 'JPY',
  CN: 'CNY', SG: 'SGD', AE: 'AED', BR: 'BRL', MX: 'MXN',
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', NZ: 'NZD', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', KR: 'KRW',
  TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP',
};

export const COUNTRY_LOCALE: Record<string, string> = {
  IN: 'en-IN', US: 'en-US', GB: 'en-GB', DE: 'de-DE', FR: 'fr-FR',
  IT: 'it-IT', ES: 'es-ES', AU: 'en-AU', CA: 'en-CA', JP: 'ja-JP',
  CN: 'zh-CN', SG: 'en-SG', AE: 'ar-AE', BR: 'pt-BR', MX: 'es-MX',
  ZA: 'en-ZA', KR: 'ko-KR', TH: 'th-TH', MY: 'ms-MY',
};

export function formatCurrency(
  amount: number,
  currency: string,
  country: string
): string {
  const locale = COUNTRY_LOCALE[country] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? 'USD';
}