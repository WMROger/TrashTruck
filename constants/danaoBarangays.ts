export const DANAO_CITY_BARANGAYS = [
  'Baliang',
  'Bayabas',
  'Binaliw',
  'Cabungahan',
  'Cagat-Lapu-Lapu',
  'Cahumayan',
  'Cambanay',
  'Cambubho',
  'Cogon-Cruz',
  'Danasan',
  'Dumolog',
  'Dunggoan',
  'Guinacot',
  'Guinsay',
  'Ibo',
  'Langosig',
  'Lawaan',
  'Looc',
  'Magtagobtob',
  'Malapoc',
  'Manlayag',
  'Mantija',
  'Masaba',
  'Maslog',
  'Nangka',
  'Oguis',
  'Pili',
  'Poblacion',
  'Quisol',
  'Sabang',
  'Sacsac',
  'Sandayong Norte',
  'Sandayong Sur',
  'Santa Rosa',
  'Santican',
  'Sibacan',
  'Suba',
  'Taboc',
  'Taytay',
  'Togonon',
  'Tuburan Sur',
] as const;

export const mergeDanaoBarangays = (configured: string[]) => Array.from(new Set([
  ...DANAO_CITY_BARANGAYS,
  ...configured.map(item => String(item || '').trim()).filter(Boolean),
])).sort((a, b) => a.localeCompare(b));

/**
 * Returns strictly the barangays created in collection schedules if any exist;
 * otherwise falls back to the standard Danao City barangays.
 */
export const resolveScheduleBarangays = (configured: string[]): string[] => {
  const clean = Array.from(
    new Set(configured.map((item) => String(item || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  return clean.length > 0 ? clean : [...DANAO_CITY_BARANGAYS];
};
