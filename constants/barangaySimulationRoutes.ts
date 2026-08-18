export type SimulationWaypoint = {
  latitude: number;
  longitude: number;
  name?: string;
  speed?: number;
  barangay?: string;
};

export const CENRO_DEPOT_WAYPOINT = {
  latitude: 10.5218,
  longitude: 124.0285,
  name: 'CENRO Municipal Depot (Origin)',
  speed: 20,
  barangay: 'Poblacion',
};

export const CENRO_RETURN_WAYPOINT = {
  latitude: 10.5218,
  longitude: 124.0285,
  name: 'CENRO Municipal Transfer Station',
  speed: 18,
  barangay: 'Poblacion',
};

// Precise, street-accurate collection loops for major Danao City sectors
export const BARANGAY_COLLECTION_ROUTES: Record<string, SimulationWaypoint[]> = {
  Poblacion: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot (Start)', speed: 20, barangay: 'Poblacion' },
    { latitude: 10.5235, longitude: 124.0290, name: 'Rizal St / City Hall Compound', speed: 25, barangay: 'Poblacion' },
    { latitude: 10.5255, longitude: 124.0298, name: 'Beatriz D. Durano Ave (Commercial)', speed: 30, barangay: 'Poblacion' },
    { latitude: 10.5270, longitude: 124.0305, name: 'Duterte St Public Market Stop', speed: 22, barangay: 'Poblacion' },
    { latitude: 10.5285, longitude: 124.0280, name: 'F. Ralota St Residential Sector', speed: 28, barangay: 'Poblacion' },
    { latitude: 10.5265, longitude: 124.0260, name: 'Pio del Pilar St Collection Point', speed: 25, barangay: 'Poblacion' },
    { latitude: 10.5240, longitude: 124.0255, name: 'Hospital Memorial Road', speed: 30, barangay: 'Poblacion' },
    { latitude: 10.5220, longitude: 124.0270, name: 'Central Terminal Link', speed: 25, barangay: 'Poblacion' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 18, barangay: 'Poblacion' },
  ],

  Suba: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 24, barangay: 'Poblacion' },
    { latitude: 10.5250, longitude: 124.0295, name: 'B.D. Durano Northward Link', speed: 35, barangay: 'Poblacion' },
    { latitude: 10.5280, longitude: 124.0315, name: 'P.G. Almendras St (Suba Entry)', speed: 32, barangay: 'Suba' },
    { latitude: 10.5298, longitude: 124.0322, name: 'Suba Elementary Collection Point', speed: 25, barangay: 'Suba' },
    { latitude: 10.5315, longitude: 124.0330, name: 'F. Ralota Coastal Access', speed: 28, barangay: 'Suba' },
    { latitude: 10.5328, longitude: 124.0318, name: 'Suba Riverside Sector Stop', speed: 26, barangay: 'Suba' },
    { latitude: 10.5305, longitude: 124.0300, name: 'Suba Chapel Cross-way', speed: 30, barangay: 'Suba' },
    { latitude: 10.5260, longitude: 124.0280, name: 'Southbound Return Arterial', speed: 38, barangay: 'Suba' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  Looc: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 25, barangay: 'Poblacion' },
    { latitude: 10.5270, longitude: 124.0305, name: 'Highway North Transit', speed: 40, barangay: 'Suba' },
    { latitude: 10.5335, longitude: 124.0335, name: 'Looc Boundary Highway', speed: 42, barangay: 'Looc' },
    { latitude: 10.5355, longitude: 124.0350, name: 'Danao Port Access Road', speed: 30, barangay: 'Looc' },
    { latitude: 10.5380, longitude: 124.0360, name: 'Looc Coastal Boardwalk Stop', speed: 28, barangay: 'Looc' },
    { latitude: 10.5405, longitude: 124.0355, name: 'Looc Norte Residential Point', speed: 32, barangay: 'Looc' },
    { latitude: 10.5390, longitude: 124.0335, name: 'Looc Interior Purok 2', speed: 25, barangay: 'Looc' },
    { latitude: 10.5350, longitude: 124.0315, name: 'Looc West Bypass Connection', speed: 38, barangay: 'Looc' },
    { latitude: 10.5280, longitude: 124.0290, name: 'National Highway South Return', speed: 45, barangay: 'Suba' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  Guinsay: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 28, barangay: 'Poblacion' },
    { latitude: 10.5320, longitude: 124.0325, name: 'North Transit Expressway', speed: 48, barangay: 'Suba' },
    { latitude: 10.5410, longitude: 124.0350, name: 'Taytay Flyover Approach', speed: 45, barangay: 'Taytay' },
    { latitude: 10.5460, longitude: 124.0320, name: 'Guinsay Boulevard Entrance', speed: 40, barangay: 'Guinsay' },
    { latitude: 10.5485, longitude: 124.0305, name: 'Guinsay National High Stop', speed: 25, barangay: 'Guinsay' },
    { latitude: 10.5510, longitude: 124.0290, name: 'Sitio Pag-utlan Waste Station', speed: 28, barangay: 'Guinsay' },
    { latitude: 10.5525, longitude: 124.0315, name: 'Guinsay Coastal Beach Hub', speed: 32, barangay: 'Guinsay' },
    { latitude: 10.5490, longitude: 124.0335, name: 'Guinsay East Purok Collection', speed: 26, barangay: 'Guinsay' },
    { latitude: 10.5440, longitude: 124.0310, name: 'Taytay South Connection', speed: 42, barangay: 'Taytay' },
    { latitude: 10.5330, longitude: 124.0310, name: 'Highway Return Corridor', speed: 48, barangay: 'Looc' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  Sabang: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 30, barangay: 'Poblacion' },
    { latitude: 10.5380, longitude: 124.0350, name: 'North Highway Transit', speed: 50, barangay: 'Looc' },
    { latitude: 10.5480, longitude: 124.0305, name: 'Guinsay Sector Transit', speed: 48, barangay: 'Guinsay' },
    { latitude: 10.5535, longitude: 124.0265, name: 'Sabang Highway Entry', speed: 52, barangay: 'Sabang' },
    { latitude: 10.5565, longitude: 124.0235, name: 'Sabang Public Market Hub', speed: 24, barangay: 'Sabang' },
    { latitude: 10.5595, longitude: 124.0205, name: 'Sabang Elementary Crossing', speed: 32, barangay: 'Sabang' },
    { latitude: 10.5620, longitude: 124.0180, name: 'Sabang North Border Turnaround', speed: 35, barangay: 'Sabang' },
    { latitude: 10.5580, longitude: 124.0220, name: 'Sabang Interior Purok Stop', speed: 26, barangay: 'Sabang' },
    { latitude: 10.5500, longitude: 124.0280, name: 'Sabang Bypass Southlink', speed: 55, barangay: 'Sabang' },
    { latitude: 10.5350, longitude: 124.0320, name: 'Southbound Expressway Return', speed: 50, barangay: 'Looc' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  Maslog: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 30, barangay: 'Poblacion' },
    { latitude: 10.5350, longitude: 124.0250, name: 'Central Bypass Northbound', speed: 42, barangay: 'Poblacion' },
    { latitude: 10.5450, longitude: 124.0200, name: 'Tuburan Hill Approach', speed: 38, barangay: 'Tuburan Sur' },
    { latitude: 10.5520, longitude: 124.0180, name: 'Maslog Bypass Road Entry', speed: 40, barangay: 'Maslog' },
    { latitude: 10.5545, longitude: 124.0165, name: 'Maslog Barangay Hall & Chapel', speed: 25, barangay: 'Maslog' },
    { latitude: 10.5570, longitude: 124.0145, name: 'Maslog Upper Purok 3 Stop', speed: 28, barangay: 'Maslog' },
    { latitude: 10.5550, longitude: 124.0125, name: 'Maslog Farm-to-Market Collection', speed: 30, barangay: 'Maslog' },
    { latitude: 10.5510, longitude: 124.0150, name: 'Maslog South Loop Link', speed: 36, barangay: 'Maslog' },
    { latitude: 10.5420, longitude: 124.0175, name: 'Tuburan Return Link', speed: 42, barangay: 'Tuburan Sur' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 22, barangay: 'Poblacion' },
  ],

  Taytay: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 26, barangay: 'Poblacion' },
    { latitude: 10.5300, longitude: 124.0310, name: 'Suba Northbound Arterial', speed: 40, barangay: 'Suba' },
    { latitude: 10.5380, longitude: 124.0340, name: 'Looc Highway Link', speed: 44, barangay: 'Looc' },
    { latitude: 10.5425, longitude: 124.0325, name: 'Taytay Junction Hub', speed: 32, barangay: 'Taytay' },
    { latitude: 10.5445, longitude: 124.0310, name: 'Taytay Bridge Collection Point', speed: 25, barangay: 'Taytay' },
    { latitude: 10.5465, longitude: 124.0290, name: 'Taytay Riverway Residential Loop', speed: 28, barangay: 'Taytay' },
    { latitude: 10.5435, longitude: 124.0340, name: 'Taytay Coastal Turnaround', speed: 30, barangay: 'Taytay' },
    { latitude: 10.5360, longitude: 124.0330, name: 'Looc Return Corridor', speed: 45, barangay: 'Looc' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  'Cogon-Cruz': [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 26, barangay: 'Poblacion' },
    { latitude: 10.5280, longitude: 124.0240, name: 'Hospital Road West Extension', speed: 35, barangay: 'Poblacion' },
    { latitude: 10.5340, longitude: 124.0190, name: 'Cogon Foothills Access', speed: 32, barangay: 'Cogon-Cruz' },
    { latitude: 10.5375, longitude: 124.0170, name: 'Cogon-Cruz Barangay Center', speed: 24, barangay: 'Cogon-Cruz' },
    { latitude: 10.5400, longitude: 124.0150, name: 'Cruz Hillside Collection Stop', speed: 28, barangay: 'Cogon-Cruz' },
    { latitude: 10.5420, longitude: 124.0165, name: 'Upper Cogon Community Hub', speed: 26, barangay: 'Cogon-Cruz' },
    { latitude: 10.5365, longitude: 124.0185, name: 'Cogon Collector Path', speed: 30, barangay: 'Cogon-Cruz' },
    { latitude: 10.5290, longitude: 124.0220, name: 'Terminal Southbound Route', speed: 38, barangay: 'Poblacion' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  'Tuburan Sur': [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 28, barangay: 'Poblacion' },
    { latitude: 10.5310, longitude: 124.0230, name: 'Northwest Transit Road', speed: 40, barangay: 'Poblacion' },
    { latitude: 10.5400, longitude: 124.0180, name: 'Tuburan Sur Valley Approach', speed: 35, barangay: 'Tuburan Sur' },
    { latitude: 10.5450, longitude: 124.0155, name: 'Tuburan Sur Barangay Hall', speed: 25, barangay: 'Tuburan Sur' },
    { latitude: 10.5480, longitude: 124.0135, name: 'Tuburan Sur Creek Sector', speed: 28, barangay: 'Tuburan Sur' },
    { latitude: 10.5495, longitude: 124.0160, name: 'Tuburan Access Link Stop', speed: 32, barangay: 'Tuburan Sur' },
    { latitude: 10.5430, longitude: 124.0175, name: 'Tuburan South Link', speed: 36, barangay: 'Tuburan Sur' },
    { latitude: 10.5280, longitude: 124.0240, name: 'City Center South Access', speed: 40, barangay: 'Poblacion' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  Dunggoan: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 25, barangay: 'Poblacion' },
    { latitude: 10.5200, longitude: 124.0250, name: 'South Arterial Highway', speed: 38, barangay: 'Poblacion' },
    { latitude: 10.5175, longitude: 124.0210, name: 'Dunggoan Highway Entry', speed: 35, barangay: 'Dunggoan' },
    { latitude: 10.5155, longitude: 124.0190, name: 'Dunggoan Port Access Collection', speed: 24, barangay: 'Dunggoan' },
    { latitude: 10.5140, longitude: 124.0220, name: 'Dunggoan Coastal Purok Stop', speed: 28, barangay: 'Dunggoan' },
    { latitude: 10.5165, longitude: 124.0240, name: 'Dunggoan Community Center', speed: 30, barangay: 'Dunggoan' },
    { latitude: 10.5190, longitude: 124.0265, name: 'National Road Northward Return', speed: 42, barangay: 'Poblacion' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],

  Taboc: [
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Depot Departure', speed: 28, barangay: 'Poblacion' },
    { latitude: 10.5170, longitude: 124.0210, name: 'South Highway Corridor', speed: 45, barangay: 'Dunggoan' },
    { latitude: 10.5125, longitude: 124.0160, name: 'Taboc Highway Boundary', speed: 40, barangay: 'Taboc' },
    { latitude: 10.5095, longitude: 124.0135, name: 'Taboc Barangay Hall & Plaza', speed: 25, barangay: 'Taboc' },
    { latitude: 10.5080, longitude: 124.0165, name: 'Taboc Coastal Sector Stop', speed: 28, barangay: 'Taboc' },
    { latitude: 10.5110, longitude: 124.0185, name: 'Taboc Upper Purok Waste Hub', speed: 32, barangay: 'Taboc' },
    { latitude: 10.5150, longitude: 124.0210, name: 'Northbound Return Highway', speed: 46, barangay: 'Dunggoan' },
    { latitude: 10.5218, longitude: 124.0285, name: 'CENRO Transfer Station', speed: 20, barangay: 'Poblacion' },
  ],
};

// Approximate Geographic Coordinates of All Danao City Barangays for Dynamic Synthesis
export const BARANGAY_ANCHORS: Record<string, { lat: number; lng: number }> = {
  Baliang: { lat: 10.5250, lng: 123.9750 },
  Bayabas: { lat: 10.5400, lng: 123.9600 },
  Binaliw: { lat: 10.5100, lng: 123.9900 },
  Cabungahan: { lat: 10.5500, lng: 123.9800 },
  'Cagat-Lapu-Lapu': { lat: 10.5320, lng: 123.9700 },
  Cahumayan: { lat: 10.5600, lng: 123.9700 },
  Cambanay: { lat: 10.5380, lng: 123.9850 },
  Cambubho: { lat: 10.5700, lng: 123.9900 },
  'Cogon-Cruz': { lat: 10.5390, lng: 124.0165 },
  Danasan: { lat: 10.5850, lng: 123.9300 },
  Dumolog: { lat: 10.5300, lng: 123.9550 },
  Dunggoan: { lat: 10.5180, lng: 124.0190 },
  Guinacot: { lat: 10.5350, lng: 123.9980 },
  Guinsay: { lat: 10.5485, lng: 124.0310 },
  Ibo: { lat: 10.5050, lng: 124.0100 },
  Langosig: { lat: 10.5150, lng: 123.9450 },
  Lawaan: { lat: 10.5450, lng: 123.9400 },
  Looc: { lat: 10.5360, lng: 124.0345 },
  Magtagobtob: { lat: 10.5750, lng: 123.9500 },
  Malapoc: { lat: 10.5200, lng: 123.9600 },
  Manlayag: { lat: 10.5650, lng: 123.9400 },
  Mantija: { lat: 10.5500, lng: 123.9600 },
  Masaba: { lat: 10.5300, lng: 123.9400 },
  Maslog: { lat: 10.5540, lng: 124.0175 },
  Nangka: { lat: 10.5100, lng: 123.9700 },
  Oguis: { lat: 10.5650, lng: 123.9600 },
  Pili: { lat: 10.5450, lng: 123.9700 },
  Poblacion: { lat: 10.5218, lng: 124.0285 },
  Quisol: { lat: 10.5550, lng: 123.9500 },
  Sabang: { lat: 10.5560, lng: 124.0240 },
  Sacsac: { lat: 10.5250, lng: 123.9500 },
  'Sandayong Norte': { lat: 10.5700, lng: 123.9600 },
  'Sandayong Sur': { lat: 10.5600, lng: 123.9500 },
  'Santa Rosa': { lat: 10.5350, lng: 123.9600 },
  Santican: { lat: 10.5400, lng: 123.9500 },
  Sibacan: { lat: 10.5150, lng: 123.9600 },
  Suba: { lat: 10.5285, lng: 124.0320 },
  Taboc: { lat: 10.5130, lng: 124.0150 },
  Taytay: { lat: 10.5430, lng: 124.0330 },
  Togonon: { lat: 10.5800, lng: 123.9400 },
  'Tuburan Sur': { lat: 10.5470, lng: 124.0150 },
};

/**
 * Returns a complete realistic collection loop starting from CENRO Municipal Depot,
 * traveling to the target Barangay, executing a collection loop within that Barangay,
 * and returning to the CENRO Transfer Station.
 */
export function getBarangaySimulationRoute(barangayName?: string): SimulationWaypoint[] {
  const target = (barangayName || 'Poblacion').trim();

  // If a curated route exists, use it
  if (BARANGAY_COLLECTION_ROUTES[target]) {
    return BARANGAY_COLLECTION_ROUTES[target];
  }

  // Find approximate coordinates for any of the 42 Danao City barangays
  const anchor = BARANGAY_ANCHORS[target] || { lat: 10.5300, lng: 124.0100 };
  const depot = { lat: 10.5218, lng: 124.0285 };

  // Intermediate outbound point
  const midOutLat = depot.lat + (anchor.lat - depot.lat) * 0.55;
  const midOutLng = depot.lng + (anchor.lng - depot.lng) * 0.55;

  // Intermediate inbound return point (offset to create realistic road loop)
  const midInLat = depot.lat + (anchor.lat - depot.lat) * 0.45 + 0.002;
  const midInLng = depot.lng + (anchor.lng - depot.lng) * 0.45 - 0.002;

  return [
    { latitude: depot.lat, longitude: depot.lng, name: 'CENRO Municipal Depot (Departure)', speed: 25, barangay: 'Poblacion' },
    { latitude: midOutLat, longitude: midOutLng, name: `Arterial Route to Brgy. ${target}`, speed: 42, barangay: target },
    { latitude: anchor.lat - 0.003, longitude: anchor.lng - 0.002, name: `Brgy. ${target} Sector Entry`, speed: 30, barangay: target },
    { latitude: anchor.lat, longitude: anchor.lng, name: `Brgy. ${target} Barangay Hall & Plaza Hub`, speed: 22, barangay: target },
    { latitude: anchor.lat + 0.003, longitude: anchor.lng + 0.002, name: `Brgy. ${target} Upper Purok Collection Point`, speed: 25, barangay: target },
    { latitude: anchor.lat + 0.001, longitude: anchor.lng + 0.004, name: `Brgy. ${target} East Residential Station`, speed: 28, barangay: target },
    { latitude: anchor.lat - 0.002, longitude: anchor.lng + 0.003, name: `Brgy. ${target} Farm-to-Market Waste Stop`, speed: 26, barangay: target },
    { latitude: midInLat, longitude: midInLng, name: `Southbound Return Corridor from ${target}`, speed: 45, barangay: target },
    { latitude: depot.lat, longitude: depot.lng, name: 'CENRO Municipal Transfer Station', speed: 20, barangay: 'Poblacion' },
  ];
}
