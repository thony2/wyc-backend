'use strict';

/**
 * routes/suppliers/helpers.js
 * Shared mapping utilities used by all supplier plugins.
 */

function mapDurability(suitability) {
  if (!suitability) return 3;
  const s = suitability.toLowerCase();
  if (s.includes('extra heavy') || s.includes('contract')) return 5;
  if (s.includes('heavy'))   return 5;
  if (s.includes('general')) return 3;
  if (s.includes('light'))   return 2;
  return 3;
}

function mapSoftness(suitability) {
  if (!suitability) return 3;
  const s = suitability.toLowerCase();
  if (s.includes('heavy'))   return 4;
  if (s.includes('general')) return 3;
  if (s.includes('light'))   return 2;
  return 3;
}

function mapCarpetStyle(name) {
  if (!name) return 'Twist';
  const n = name.toLowerCase();
  if (n.includes('saxony')) return 'Saxony';
  if (n.includes('berber')) return 'Berber';
  if (n.includes('loop'))   return 'Loop Pile';
  if (n.includes('velvet')) return 'Velvet';
  if (n.includes('twist'))  return 'Twist';
  return 'Twist';
}

function mapFeatures(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const out = new Set();
  if (t.includes('bleach'))                                             out.add('bleach');
  if (t.includes('stain resist'))                                       out.add('stain');
  if (t.includes('easy to clean') || t.includes('ease of maintenance') || t.includes('easy clean')) out.add('easyClean');
  if (t.includes('underfloor heating') || t.includes('ufh'))           out.add('insulation');
  if (t.includes('pet friendly') || t.includes('pet-friendly'))        out.add('pet');
  if (t.includes('luxurious') || t.includes('ultra soft'))             out.add('soft');
  if (t.includes('waterproof') || t.includes('water resistant') || t.includes('water proof')) out.add('waterproof');
  if (t.includes('scratch resist'))                                     out.add('scratch');
  return [...out];
}

function mapRooms(text) {
  const DEFAULT = ['living', 'bedroom', 'hallway', 'stairs'];
  if (!text) return DEFAULT;
  const t = text.toLowerCase();
  const out = new Set();
  if (t.includes('living') || t.includes('dining') || t.includes('lounge')) out.add('living');
  if (t.includes('bedroom'))                out.add('bedroom');
  if (t.includes('kitchen'))                out.add('kitchen');
  if (t.includes('bathroom'))               out.add('bathroom');
  if (t.includes('hall'))                   out.add('hallway');
  if (t.includes('stair') || t.includes('landing')) out.add('stairs');
  return out.size > 0 ? [...out] : DEFAULT;
}

function mapHardFloorRooms(text) {
  // Hard floors default: living, kitchen, hallway (not stairs/bedroom by default)
  const DEFAULT = ['living', 'kitchen', 'hallway'];
  if (!text) return DEFAULT;
  const t = text.toLowerCase();
  const out = new Set();
  if (t.includes('living') || t.includes('dining') || t.includes('lounge')) out.add('living');
  if (t.includes('bedroom'))           out.add('bedroom');
  if (t.includes('kitchen'))           out.add('kitchen');
  if (t.includes('bathroom'))          out.add('bathroom');
  if (t.includes('hall'))              out.add('hallway');
  if (t.includes('stair'))             out.add('stairs');
  return out.size > 0 ? [...out] : DEFAULT;
}

function hexFromName(name) {
  const n = (name || '').toLowerCase();
  if (/grey|gray|ash|slate|charcoal|silver|smoke|steel|storm|graphite|pewter|flint|mist|fog|pebble|dove|shadow/.test(n)) return '#9E9E9E';
  if (/beige|sand|stone|linen|taupe|biscuit|natural|parchment|mushroom|buff|oat|barley|wheat|straw|hessian|jute|wheat/.test(n)) return '#C8B89A';
  if (/brown|mocha|chocolate|walnut|chestnut|coffee|toffee|caramel|hazel|umber|cinnamon|nutmeg|sienna|harvest|bracken/.test(n)) return '#795548';
  if (/cream|ivory|pearl|white|vanilla|almond|magnolia|chalk|snow|frost|polar|crystal|sugar|milk|porcelain|latte|moon|maple|birch|ecru/.test(n)) return '#F5F0E8';
  if (/black|noir|onyx|ebony|jet|midnight|raven|ink/.test(n)) return '#212121';
  if (/blue|navy|teal|cobalt|sapphire|azure|denim|indigo|ocean|lake|marine|nordic|stream/.test(n)) return '#1565C0';
  if (/green|sage|olive|moss|fern|forest|jade|mint|emerald|pistachio/.test(n)) return '#558B2F';
  if (/gold|amber|honey|mustard|ochre|bronze|autumn|saffron/.test(n)) return '#F9A825';
  if (/red|rose|blush|coral|rust|terracotta|burgundy|wine|berry|plum|pink|mauve|peach|dusky/.test(n)) return '#C62828';
  if (/oak|wood|timber|pine|cedar|cherry|mahogany|teak|bamboo/.test(n)) return '#A0522D';
  return '#A0A0A0';
}

function colourFamilyFromName(name) {
  const n = (name || '').toLowerCase();
  if (/grey|gray|ash|slate|charcoal|silver|smoke|steel|storm|graphite|pewter|flint|mist|fog|pebble|dove|shadow/.test(n)) return 'greys';
  if (/beige|sand|stone|linen|taupe|biscuit|natural|parchment|mushroom|buff|oat|barley|wheat|straw|hessian|jute/.test(n)) return 'beiges';
  if (/brown|mocha|chocolate|walnut|chestnut|coffee|toffee|caramel|hazel|umber|cinnamon|nutmeg|sienna|harvest|bracken/.test(n)) return 'browns';
  if (/cream|ivory|pearl|white|vanilla|almond|magnolia|chalk|snow|frost|polar|crystal|sugar|milk|porcelain|latte|moon|maple|birch|ecru/.test(n)) return 'creams';
  if (/black|noir|onyx|ebony|jet|midnight|raven|ink/.test(n)) return 'blacks';
  if (/blue|navy|teal|cobalt|sapphire|azure|denim|indigo|ocean|lake|marine|nordic/.test(n)) return 'blues';
  if (/green|sage|olive|moss|fern|forest|jade|mint|emerald|pistachio/.test(n)) return 'greens';
  if (/gold|amber|honey|mustard|ochre|bronze|autumn|saffron/.test(n)) return 'golds';
  if (/red|rose|blush|coral|rust|terracotta|burgundy|wine|berry|plum|pink|mauve|peach|dusky/.test(n)) return 'reds';
  if (/oak|wood|timber|pine|cedar|cherry|mahogany|teak|bamboo/.test(n)) return 'browns';
  return 'neutrals';
}

function dominantColourFamily(colours) {
  const counts = {};
  colours.forEach(c => {
    const f = colourFamilyFromName(c.supplierName || c.wycName);
    counts[f] = (counts[f] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutrals';
}

function normaliseFibre(raw) {
  if (!raw) return 'Mixed Fibres';
  const r = raw.toLowerCase();
  if (r.includes('polypropylene') && r.includes('recycled')) return '100% Recycled Polyester';
  if (r.includes('excellon') || r.includes('polypropylene')) return '100% Polypropylene';
  if (r.includes('recycled') && r.includes('polyester'))     return '100% Recycled Polyester';
  if (r.includes('polyester'))   return '100% Polyester';
  if (r.includes('wool'))        return '100% Wool';
  if (r.includes('tencel'))      return 'Mixed Fibres'; // wool/tencel blend
  if (raw.trim().length > 0)     return raw.trim();
  return 'Mixed Fibres';
}

// Parse thickness like "15mm" → 15.0
function parseFloatMm(text) {
  if (!text) return null;
  const m = text.match(/(\d+\.?\d*)\s*mm/i);
  return m ? parseFloat(m[1]) : null;
}

// Parse plank width from text like "190mm wide" or "240mm"
function parsePlankWidth(text) {
  if (!text) return null;
  const m = text.match(/(\d+)\s*mm/i);
  return m ? parseFloat(m[1]) : null;
}

function parseInstallation(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const methods = [];
  if (t.includes('click') || t.includes('glueless') || t.includes('floating') || t.includes('floated') || t.includes('float')) methods.push('Click');
  if (t.includes('glue') || t.includes('stuck down') || t.includes('adhesive')) methods.push('Glue Down');
  if (t.includes('nail') || t.includes('secret nail')) methods.push('Nail Down');
  if (t.includes('loose lay')) methods.push('Loose Lay');
  if (methods.length === 0) return null;
  return methods[0]; // return primary method
}

function parseSurfaceFinish(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes('oiled') || t.includes('oil')) return 'Oiled';
  if (t.includes('lacquered') || t.includes('lacquer')) return 'Lacquered';
  if (t.includes('brushed')) return 'Brushed';
  if (t.includes('smoked')) return 'Smoked';
  if (t.includes('matt')) return 'Matt';
  return null;
}

function parseLayPattern(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes('herringbone')) return 'Herringbone';
  if (t.includes('chevron'))     return 'Chevron';
  return 'Straight';
}

function parseUFH(text) {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t.includes('suitable') && (t.includes('underfloor') || t.includes('ufh'))) return 1;
  if (t.includes('compatible') && (t.includes('underfloor') || t.includes('ufh'))) return 1;
  if (t.includes('underfloor heating')) return 1;
  return 0;
}

module.exports = {
  mapDurability, mapSoftness, mapCarpetStyle,
  mapFeatures, mapRooms, mapHardFloorRooms,
  hexFromName, colourFamilyFromName, dominantColourFamily,
  normaliseFibre, parseFloatMm, parsePlankWidth,
  parseInstallation, parseSurfaceFinish, parseLayPattern, parseUFH,
};
