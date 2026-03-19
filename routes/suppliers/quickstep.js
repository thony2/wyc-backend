'use strict';

/**
 * Supplier plugin: Quick-Step (and generic laminate fallback)
 * quick-step.co.uk / quick-step.com
 * Also handles: egger.com, kronotex.de/co.uk
 *
 * Semi-auto — text specs scraped, image manual.
 * Category: laminate
 */

const cheerio = require('cheerio');
const {
  mapFeatures, mapHardFloorRooms, hexFromName, colourFamilyFromName,
  parseFloatMm, parsePlankWidth, parseInstallation, parseUFH,
} = require('./helpers');

const DOMAINS = [
  'quick-step.co.uk', 'quick-step.com',
  'egger.com', 'egger.co.uk',
  'kronotex.co.uk', 'kronotex.com',
];

async function parse(html, url) {
  const $ = cheerio.load(html);

  const productName = $('h1').first().text().trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  let description = '';
  $('p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 60 && !description && !/cookie|privacy|menu|basket/i.test(t)) {
      description = t.substring(0, 250);
    }
  });

  const fullText = $('body').text();

  // Thickness
  let thickness_mm = null;
  const thickMatch = fullText.match(/(\d+\.?\d*)\s*mm\s+(?:thick|thickness)/i) ||
                     fullText.match(/thickness[:\s]+(\d+\.?\d*)\s*mm/i);
  if (thickMatch) thickness_mm = parseFloat(thickMatch[1]);

  // AC rating
  let ac_rating = null;
  const acMatch = fullText.match(/AC\s*([3-5])/i);
  if (acMatch) ac_rating = 'AC' + acMatch[1];

  // Board design
  let board_design = 'Wood Effect';
  if (/stone effect|tile effect|concrete|marble/i.test(fullText + productName)) board_design = 'Stone Effect';
  else if (/tile effect/i.test(fullText + productName)) board_design = 'Tile Effect';

  // Plank width
  let plank_width_mm = null;
  const widthMatch = fullText.match(/width[:\s]+(\d+)\s*mm/i) ||
                     fullText.match(/(\d+)\s*mm\s+(?:wide|width)/i);
  if (widthMatch) plank_width_mm = parseFloat(widthMatch[1]);

  const installation_method = parseInstallation(fullText) || 'Click';
  const ufh_compatible = parseUFH(fullText);

  const features = [...new Set([
    ...mapFeatures(fullText),
    'scratch', // laminate is scratch resistant by nature
  ])];

  const rooms = mapHardFloorRooms(fullText);

  const colours = [{
    supplierName: productName,
    wycName:      productName,
    imgUrl:       null,
    hex:          hexFromName(productName),
    colourFamily: colourFamilyFromName(productName),
  }];

  return {
    supplierName: productName,
    wycName:      productName,
    category:     'laminate',
    imagesAuto:   false,
    specs: {
      description:          description || productName,
      features,
      rooms,
      dominantColourFamily: colourFamilyFromName(productName),
      durability:           4,
      thickness_mm,
      ac_rating,
      board_design,
      plank_width_mm,
      installation_method,
      ufh_compatible,
    },
    colours,
  };
}

module.exports = { domains: DOMAINS, category: 'laminate', parse };
