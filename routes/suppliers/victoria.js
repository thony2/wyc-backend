'use strict';

/**
 * Supplier plugin: Victoria Carpets
 * victoriacarpets.com
 *
 * Semi-auto — text/colour names scraped, images need manual paste.
 * Colour names and family tags are in raw HTML.
 */

const cheerio = require('cheerio');
const {
  mapDurability, mapSoftness, mapCarpetStyle,
  mapFeatures, mapRooms,
  hexFromName, colourFamilyFromName, dominantColourFamily,
} = require('./helpers');

const DOMAINS = ['victoriacarpets.com'];

// Victoria warranty icon filenames map to features
function featuresFromIcons($) {
  const features = new Set();
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '').toLowerCase();
    if (src.includes('stain'))       features.add('stain');
    if (src.includes('bleach'))      features.add('bleach');
    if (src.includes('easy'))        features.add('easyClean');
    if (src.includes('underfloor') || src.includes('ufh')) features.add('insulation');
    if (src.includes('pet'))         features.add('pet');
    if (src.includes('waterproof'))  features.add('waterproof');
  });
  return [...features];
}

async function parse(html, url) {
  const $ = cheerio.load(html);

  // Family name from h1 or page title
  const familyName =
    $('h1').first().text().trim() ||
    $('title').text().replace(/Victoria Carpets.*/, '').trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  // Description
  const description = $('p').first().text().trim() || `${familyName} carpet by Victoria Carpets.`;

  // Full page text for feature/room mapping
  const fullText = $('body').text();

  // Extract suitability — Victoria pages often mention it in body text
  let suitability = 'General Domestic';
  if (/heavy domestic/i.test(fullText))   suitability = 'Heavy Domestic';
  if (/general domestic/i.test(fullText)) suitability = 'General Domestic';
  if (/light domestic/i.test(fullText))   suitability = 'Light Domestic';

  // Pile weight — Victoria often shows oz rating e.g. "43oz"
  let pileWeight = '';
  const ozMatch = fullText.match(/(\d+)\s*oz/);
  if (ozMatch) pileWeight = ozMatch[0];

  // Fibre — look for wool content statements
  let fibre = 'Mixed Fibres';
  if (/100%\s*wool/i.test(fullText))              fibre = '100% Wool';
  if (/80%\s*wool/i.test(fullText))               fibre = 'Mixed Fibres';
  if (/wool.*tencel|tencel.*wool/i.test(fullText)) fibre = 'Mixed Fibres';
  if (/polypropylene/i.test(fullText))             fibre = '100% Polypropylene';
  if (/polyester/i.test(fullText))                 fibre = '100% Polyester';

  // Colours — Victoria renders colour name + colour family tag in pairs
  // Pattern: <colour-family-icon> <colour-family-text> <colour-name>
  // In raw HTML, colour names appear after the SVG colour icons
  // Each colour has: colour family label (cream/grey etc) and actual colour name
  const colours = [];
  const seen = new Set();

  // Victoria structure: colour family icons first (filter row), then per-colour items
  // Each item contains: colour-family icon, colour-family text, colour name, product code
  // We extract text nodes that look like colour names (Title Case, not nav items)
  const bodyText = $.html();

  // Extract colour entries — they follow the pattern:
  // [colour-family-svg] [colour-family-name] [Colour Name] Add Sample [CODE | Xoz]
  // The colour name is the meaningful text between family name and "Add Sample"
  const colourPattern = /(?:cream|dark grey|grey|light grey|brown|beige|blue|green|red|white|gold|purple|black|pink|yellow|silver)\s*\n?\s*([A-Z][a-z][\w\s]+?)\s*\n?\s*Add Sample\s*\n?\s*([A-Z0-9]+)\s*\|\s*(\d+oz)/gi;
  let m;
  while ((m = colourPattern.exec(fullText)) !== null) {
    const colourName = m[1].trim();
    const code       = m[2].trim();
    if (!colourName || seen.has(colourName)) continue;
    seen.add(colourName);
    colours.push({
      supplierName: colourName,
      wycName:      colourName,
      imgUrl:       null, // manual paste required
      hex:          hexFromName(colourName),
      colourFamily: colourFamilyFromName(colourName),
      code,
    });
  }

  // Fallback: extract from visible text nodes that follow colour filter chips
  if (colours.length === 0) {
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const colourFamilyWords = ['cream','dark grey','grey','light grey','brown','beige','blue','green','red','white','gold','purple','black','pink','yellow','silver'];
    let nextIsColour = false;
    for (const line of lines) {
      if (colourFamilyWords.includes(line.toLowerCase())) {
        nextIsColour = true;
        continue;
      }
      if (nextIsColour && /^[A-Z][a-z]/.test(line) && line.length < 40 && !line.includes('http')) {
        if (!seen.has(line)) {
          seen.add(line);
          colours.push({
            supplierName: line,
            wycName:      line,
            imgUrl:       null,
            hex:          hexFromName(line),
            colourFamily: colourFamilyFromName(line),
          });
        }
        nextIsColour = false;
      } else {
        nextIsColour = false;
      }
    }
  }

  const descriptionFull = `${familyName} — ${suitability}. ${pileWeight ? pileWeight + ' pile weight.' : ''}`.trim();

  return {
    supplierName: familyName,
    wycName:      familyName,
    category:     'carpets',
    imagesAuto:   false,
    specs: {
      fibre,
      pileWeight,
      suitability,
      carpetStyle:          mapCarpetStyle(familyName),
      durability:           mapDurability(suitability),
      softness:             mapSoftness(suitability),
      description:          descriptionFull,
      features:             [...new Set([...featuresFromIcons($), ...mapFeatures(fullText)])],
      rooms:                mapRooms(fullText),
      dominantColourFamily: colours.length > 0 ? dominantColourFamily(colours) : 'neutrals',
    },
    colours,
  };
}

module.exports = { domains: DOMAINS, category: 'carpets', parse };
