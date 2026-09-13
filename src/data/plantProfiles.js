export const PLANT_PROFILES = {
  money_plant: {
    id: 'money_plant',
    name: 'Money Plant',
    commonName: 'Epipremnum Aureum (Devil\'s Ivy)',
    specimenImage: '/assets/specimens/pothos.jpg',
    status: 'optimal',
    statusLabel: 'Optimal Foliage',
    vigor: 93,
    colorScheme: {
      primary: '#86efac',       // Pastel Mint
      secondary: '#a7f3d0',
      surface: 'rgba(134, 239, 172, 0.14)',
      border: 'rgba(134, 239, 172, 0.35)',
      glow: 'rgba(134, 239, 172, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 91, unit: '%', label: 'Chlorophyll', status: 'optimal', color: '#86efac' },
      hydration: { value: 85, unit: '%', label: 'Turgor Pressure', status: 'optimal', color: '#bae6fd' },
      solarPAR: { value: 78, unit: '%', label: 'Ambient Light Flux', status: 'optimal', color: '#fef08a' },
      cuticle: { value: 95, unit: '%', label: 'Cuticle Vigor', status: 'optimal', color: '#86efac' }
    },
    tissueData: {
      transpirationRate: '4.5 mmol/m²s',
      leafTemp: '22.0°C',
      stomataStatus: 'Open / Transpiring',
      pathogenRisk: '0.01'
    },
    pins: [
      { id: 'mp1', x: 48, y: 38, label: 'Heart Blade', score: 95, color: '#86efac', note: 'Active chlorophyll synthesis' },
      { id: 'mp2', x: 30, y: 55, label: 'Variegation Zone', score: 92, color: '#86efac', note: 'Carotenoid / green balance' },
      { id: 'mp3', x: 65, y: 68, label: 'Petiole Runner', score: 89, color: '#bae6fd', note: 'Turgor pressure robust' }
    ]
  },
  monstera: {
    id: 'monstera',
    name: 'Monstera Deliciosa',
    commonName: 'Swiss Cheese Plant',
    specimenImage: '/assets/specimens/monstera.jpg',
    status: 'optimal',
    statusLabel: 'Flourishing',
    vigor: 94,
    colorScheme: {
      primary: '#86efac',       // Pastel Mint
      secondary: '#6ee7b7',
      surface: 'rgba(134, 239, 172, 0.14)',
      border: 'rgba(134, 239, 172, 0.35)',
      glow: 'rgba(134, 239, 172, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 92, unit: '%', label: 'Chlorophyll', status: 'optimal', color: '#86efac' },
      hydration: { value: 84, unit: '%', label: 'Turgor Pressure', status: 'optimal', color: '#bae6fd' },
      solarPAR: { value: 78, unit: '%', label: 'Light Exposure', status: 'optimal', color: '#fef08a' },
      cuticle: { value: 96, unit: '%', label: 'Cuticle Vigor', status: 'optimal', color: '#a7f3d0' }
    },
    tissueData: {
      transpirationRate: '4.8 mmol/m²s',
      leafTemp: '21.4°C',
      stomataStatus: 'Open / Active',
      pathogenRisk: '0.02'
    },
    pins: [
      { id: 'p1', x: 38, y: 32, label: 'Apex Fenestration', score: 96, color: '#86efac', note: 'Active cell division' },
      { id: 'p2', x: 62, y: 48, label: 'Lateral Blade', score: 93, color: '#86efac', note: 'High chlorophyll index' },
      { id: 'p3', x: 30, y: 65, label: 'Basal Petiole', score: 91, color: '#bae6fd', note: 'Hydration flow balanced' }
    ]
  },
  calathea: {
    id: 'calathea',
    name: 'Calathea Roseopicta',
    commonName: 'Peacock Plant',
    specimenImage: '/assets/specimens/calathea.jpg',
    status: 'warning',
    statusLabel: 'Hydration Alert',
    vigor: 64,
    colorScheme: {
      primary: '#fed7aa',       // Pastel Peach / Apricot
      secondary: '#fdba74',
      surface: 'rgba(254, 215, 170, 0.14)',
      border: 'rgba(254, 215, 170, 0.35)',
      glow: 'rgba(254, 215, 170, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 74, unit: '%', label: 'Chlorophyll', status: 'optimal', color: '#86efac' },
      hydration: { value: 42, unit: '%', label: 'Turgor Pressure', status: 'warning', color: '#fed7aa' },
      solarPAR: { value: 65, unit: '%', label: 'Light Exposure', status: 'optimal', color: '#fef08a' },
      cuticle: { value: 68, unit: '%', label: 'Cuticle Vigor', status: 'warning', color: '#fca5a5' }
    },
    tissueData: {
      transpirationRate: '2.1 mmol/m²s',
      leafTemp: '23.8°C',
      stomataStatus: 'Constricted (Water Stress)',
      pathogenRisk: '0.11'
    },
    pins: [
      { id: 'c1', x: 44, y: 35, label: 'Central Vein', score: 72, color: '#86efac', note: 'Vascular transport active' },
      { id: 'c2', x: 72, y: 56, label: 'Leaf Margin', score: 48, color: '#fed7aa', note: 'Incipient tip curl' },
      { id: 'c3', x: 26, y: 68, label: 'Lower Foliage', score: 55, color: '#fed7aa', note: 'Soil humidity low' }
    ]
  },
  ficus: {
    id: 'ficus',
    name: 'Ficus Elastica',
    commonName: 'Rubber Tree',
    specimenImage: '/assets/specimens/ficus.jpg',
    status: 'mild_stress',
    statusLabel: 'Nutrient Balance',
    vigor: 76,
    colorScheme: {
      primary: '#fef08a',       // Pastel Primrose
      secondary: '#fde047',
      surface: 'rgba(254, 240, 138, 0.14)',
      border: 'rgba(254, 240, 138, 0.35)',
      glow: 'rgba(254, 240, 138, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 68, unit: '%', label: 'Chlorophyll', status: 'warning', color: '#fef08a' },
      hydration: { value: 76, unit: '%', label: 'Turgor Pressure', status: 'optimal', color: '#bae6fd' },
      solarPAR: { value: 88, unit: '%', label: 'Light Exposure', status: 'optimal', color: '#fef08a' },
      cuticle: { value: 89, unit: '%', label: 'Cuticle Vigor', status: 'optimal', color: '#86efac' }
    },
    tissueData: {
      transpirationRate: '3.9 mmol/m²s',
      leafTemp: '22.1°C',
      stomataStatus: 'Open',
      pathogenRisk: '0.04'
    },
    pins: [
      { id: 'f1', x: 48, y: 28, label: 'New Sheath', score: 88, color: '#86efac', note: 'Vigorous emergence' },
      { id: 'f2', x: 32, y: 52, label: 'Mid Leaf Blade', score: 68, color: '#fef08a', note: 'Mild nitrogen requirement' },
      { id: 'f3', x: 68, y: 64, label: 'Mature Leaf', score: 79, color: '#bae6fd', note: 'Waxy layer intact' }
    ]
  }
};
