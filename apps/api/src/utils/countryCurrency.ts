export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR',
  IT: 'EUR', ES: 'EUR', AU: 'AUD', CA: 'CAD', JP: 'JPY',
  CN: 'CNY', SG: 'SGD', AE: 'AED', BR: 'BRL', MX: 'MXN',
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', NZ: 'NZD', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', RU: 'RUB',
  KR: 'KRW', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP',
};

export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? 'USD';
}