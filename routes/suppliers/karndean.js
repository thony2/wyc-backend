'use strict';

/**
 * Supplier plugin: Karndean
 * karndean.com
 *
 * Semi-auto — text specs scraped, image manual.
 * Category: vinyl
 */

const cheerio = require('cheerio');
const {
  mapFeatures, mapHardFloorRooms, hexFromName, colourFamilyFromName,
  parseFloatMm, parsePlankWidth, parseInstallation, parseLayPattern, parseUFH,
} = require('./helpers');

const DOMAINS = ['karndean.com'];

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

  // Wear layer
  let wear_layer_mm = null;
  const wearMatch = fullText.match(/(\d+\.?\d*)\s*mm\s+(?:wear|wearlayer)/i) ||
                    fullText.match(/wear\s+layer[:\s]+(\d+\.?\d*)\s*mm/i);
  if (wearMatch) wear_layer_mm = parseFloat(wearMatch[1]);

  // Plank width
  let plank_width_mm = null;
  const widthMatch = fullText.match(/width[:\s]+(\d+)\s*mm/i) ||
                     fullText.match(/(\d+)\s*mm\s+(?:wide|width)/i);
  if (widthMatch) plank_width_mm = parseFloat(widthMatch[1]);

  const installation_method = parseInstallation(fullText) || 'Glue Down';
  const ufh_compatible = parseUFH(fullText);
  const lay_pattern = parseLayPattern(productName + ' ' + fullText);

  const features = [...new Set([
    ...mapFeatures(fullText),
    'waterproof', // all LVT is waterproof
  ])];

  const rooms = mapHardFloorRooms(fullText + ' kitchen bathroom');

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
    category:     'vinyl',
    imagesAuto:   false,
    specs: {
      description:          description || productName,
      features,
      rooms,
      dominantColourFamily: colourFamilyFromName(productName),
      durability:           4,
      thickness_mm,
      wear_layer_mm,
      plank_width_mm,
      installation_method,
      ufh_compatible,
      lay_pattern,
    },
    colours,
  };
}

module.exports = { domains: DOMAINS, category: 'vinyl', parse };
