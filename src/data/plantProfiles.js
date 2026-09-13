export const PLANT_PROFILES = {
  money_plant: {
    id: 'money_plant',
    name: 'Money Plant',
    commonName: 'Devil\'s Ivy (Epipremnum)',
    specimenImage: '/assets/specimens/pothos.jpg',
    status: 'optimal',
    statusLabel: 'Thriving & Healthy',
    vigor: 93,
    colorScheme: {
      primary: '#86efac',       // Pastel Mint
      secondary: '#a7f3d0',
      surface: 'rgba(134, 239, 172, 0.14)',
      border: 'rgba(134, 239, 172, 0.35)',
      glow: 'rgba(134, 239, 172, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 91, unit: '%', label: 'Leaf Vitality', detail: 'Rich & Vibrant', color: '#86efac' },
      hydration: { value: 85, unit: '%', label: 'Water Level', detail: 'Well Hydrated', color: '#bae6fd' },
      solarPAR: { value: 78, unit: '%', label: 'Sunlight', detail: 'Ideal Indirect Light', color: '#fef08a' },
      cuticle: { value: 95, unit: '%', label: 'Leaf Shine', detail: 'Clean & Glossy', color: '#a7f3d0' }
    },
    careTips: [
      { icon: '💧', title: 'Watering', desc: 'Water once a week or when the top 1 inch of soil feels dry.' },
      { icon: '☀️', title: 'Sunlight', desc: 'Loves bright, indirect light near a window or desk lamp.' },
      { icon: '🪴', title: 'Leaf Care', desc: 'Wipe leaves gently with a damp cloth to remove room dust.' },
      { icon: '🌡️', title: 'Temperature', desc: 'Enjoys comfortable room temperature (18°C – 28°C).' }
    ],
    pins: [
      { id: 'mp1', x: 48, y: 38, label: 'Top Leaf', score: 95, color: '#86efac', note: 'Strong new growth' },
      { id: 'mp2', x: 30, y: 55, label: 'Golden Pattern', score: 92, color: '#86efac', note: 'Vibrant variegation' },
      { id: 'mp3', x: 65, y: 68, label: 'Healthy Vine', score: 89, color: '#bae6fd', note: 'Firm water-rich stem' }
    ]
  },
  monstera: {
    id: 'monstera',
    name: 'Monstera Deliciosa',
    commonName: 'Swiss Cheese Plant',
    specimenImage: '/assets/specimens/monstera.jpg',
    status: 'optimal',
    statusLabel: 'Looking Great',
    vigor: 94,
    colorScheme: {
      primary: '#86efac',       // Pastel Mint
      secondary: '#6ee7b7',
      surface: 'rgba(134, 239, 172, 0.14)',
      border: 'rgba(134, 239, 172, 0.35)',
      glow: 'rgba(134, 239, 172, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 92, unit: '%', label: 'Leaf Vitality', detail: 'Vibrant Green', color: '#86efac' },
      hydration: { value: 84, unit: '%', label: 'Water Level', detail: 'Healthy Moisture', color: '#bae6fd' },
      solarPAR: { value: 78, unit: '%', label: 'Sunlight', detail: 'Gentle Bright Light', color: '#fef08a' },
      cuticle: { value: 96, unit: '%', label: 'Leaf Shine', detail: 'Smooth & Protected', color: '#a7f3d0' }
    },
    careTips: [
      { icon: '💧', title: 'Watering', desc: 'Water thoroughly every 1 to 2 weeks, letting soil dry slightly.' },
      { icon: '☀️', title: 'Sunlight', desc: 'Filtered bright indirect light keeps fenestrations large.' },
      { icon: '🌿', title: 'Mist & Dust', desc: 'Mist occasionally if your room has dry winter heating or AC.' },
      { icon: '🪴', title: 'Growth Support', desc: 'Use a moss pole to guide leaves upward as it matures.' }
    ],
    pins: [
      { id: 'p1', x: 38, y: 32, label: 'Main Leaf Cut', score: 96, color: '#86efac', note: 'Beautiful split leaf' },
      { id: 'p2', x: 62, y: 48, label: 'Side Blade', score: 93, color: '#86efac', note: 'Healthy chlorophyll' },
      { id: 'p3', x: 30, y: 65, label: 'Stem Base', score: 91, color: '#bae6fd', note: 'Strong support' }
    ]
  },
  calathea: {
    id: 'calathea',
    name: 'Calathea Roseopicta',
    commonName: 'Peacock Plant',
    specimenImage: '/assets/specimens/calathea.jpg',
    status: 'warning',
    statusLabel: 'Needs Water Soon',
    vigor: 64,
    colorScheme: {
      primary: '#fed7aa',       // Pastel Peach / Apricot
      secondary: '#fdba74',
      surface: 'rgba(254, 215, 170, 0.14)',
      border: 'rgba(254, 215, 170, 0.35)',
      glow: 'rgba(254, 215, 170, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 74, unit: '%', label: 'Leaf Vitality', detail: 'Good Color', color: '#86efac' },
      hydration: { value: 42, unit: '%', label: 'Water Level', detail: 'Soil is Drying Out', color: '#fed7aa' },
      solarPAR: { value: 65, unit: '%', label: 'Sunlight', detail: 'Mild Shaded Light', color: '#fef08a' },
      cuticle: { value: 68, unit: '%', label: 'Leaf Shine', detail: 'Tips Curling Slightly', color: '#fca5a5' }
    },
    careTips: [
      { icon: '💧', title: 'Water Soon', desc: 'Soil is running dry. Give it a gentle drink of filtered water.' },
      { icon: '🌫️', title: 'Humidity', desc: 'Calatheas love humid air. Mist or place near a humidifier.' },
      { icon: '☀️', title: 'Low Direct Sun', desc: 'Avoid direct harsh sun to protect the colorful leaf patterns.' },
      { icon: '💧', title: 'Filtered Water', desc: 'Sensitive to tap water chemicals; use room temp filtered water.' }
    ],
    pins: [
      { id: 'c1', x: 44, y: 35, label: 'Center Pattern', score: 72, color: '#86efac', note: 'Good color balance' },
      { id: 'c2', x: 72, y: 56, label: 'Leaf Edge', score: 48, color: '#fed7aa', note: 'Tip needs moisture' },
      { id: 'c3', x: 26, y: 68, label: 'Lower Foliage', score: 55, color: '#fed7aa', note: 'Give water soon' }
    ]
  },
  ficus: {
    id: 'ficus',
    name: 'Ficus Elastica',
    commonName: 'Rubber Tree',
    specimenImage: '/assets/specimens/ficus.jpg',
    status: 'mild_stress',
    statusLabel: 'Doing Well',
    vigor: 76,
    colorScheme: {
      primary: '#fef08a',       // Pastel Primrose
      secondary: '#fde047',
      surface: 'rgba(254, 240, 138, 0.14)',
      border: 'rgba(254, 240, 138, 0.35)',
      glow: 'rgba(254, 240, 138, 0.4)'
    },
    metrics: {
      chlorophyll: { value: 68, unit: '%', label: 'Leaf Vitality', detail: 'Moderate Green', color: '#fef08a' },
      hydration: { value: 76, unit: '%', label: 'Water Level', detail: 'Comfortable', color: '#bae6fd' },
      solarPAR: { value: 88, unit: '%', label: 'Sunlight', detail: 'Loves Good Light', color: '#fef08a' },
      cuticle: { value: 89, unit: '%', label: 'Leaf Shine', detail: 'Waxy & Tough', color: '#86efac' }
    },
    careTips: [
      { icon: '☀️', title: 'Sunlight', desc: 'Place near bright morning light to keep new leaves shiny.' },
      { icon: '💧', title: 'Watering', desc: 'Let top 2 inches of soil dry before watering thoroughly.' },
      { icon: '✨', title: 'Dust Leaves', desc: 'Wipe broad leaves with a soft towel once a month.' },
      { icon: '🪴', title: 'Drainage', desc: 'Ensure pot has a drainage hole to avoid water pooling.' }
    ],
    pins: [
      { id: 'f1', x: 48, y: 28, label: 'New Leaf Sheath', score: 88, color: '#86efac', note: 'New leaf sprouting' },
      { id: 'f2', x: 32, y: 52, label: 'Upper Blade', score: 68, color: '#fef08a', note: 'Enjoys good light' },
      { id: 'f3', x: 68, y: 64, label: 'Mature Leaf', score: 79, color: '#bae6fd', note: 'Tough waxy surface' }
    ]
  }
};
