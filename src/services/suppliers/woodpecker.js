'use strict';

/**
 * Supplier plugin: Woodpecker Flooring
 * woodpeckerflooring.co.uk
 *
 * Semi-auto — all spec data scraped from FAQ/description text, image manual.
 * Each product page = one product (not a family with colours).
 * Category: wood
 */

const cheerio = require('cheerio');
const {
  mapFeatures, mapHardFloorRooms, hexFromName, colourFamilyFromName,
  parseFloatMm, parsePlankWidth, parseInstallation, parseSurfaceFinish,
  parseLayPattern, parseUFH,
} = require('./helpers');

const DOMAINS = ['woodpeckerflooring.co.uk'];

async function parse(html, url) {
  const $ = cheerio.load(html);

  const productName = $('h1').first().text().trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  // Description
  let description = '';
  $('p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 60 && !description && !/cookie|privacy|menu/i.test(t)) {
      description = t.substring(0, 250);
    }
  });

  const fullText = $('body').text();

  // Thickness — "Xmm thick" pattern
  let thickness_mm = null;
  const thickMatch = fullText.match(/(\d+\.?\d*)\s*mm\s+thick/i);
  if (thickMatch) thickness_mm = parseFloat(thickMatch[1]);

  // Wear layer — "Xmm real oak wear layer" or "Xmm wear layer"
  let wear_layer_mm = null;
  const wearMatch = fullText.match(/(\d+\.?\d*)\s*mm\s+(?:real\s+(?:oak|wood)\s+)?wear\s+layer/i);
  if (wearMatch) wear_layer_mm = parseFloat(wearMatch[1]);

  // Plank width — "190mm" or "240mm" width mentioned
  let plank_width_mm = null;
  const widthMatch = fullText.match(/(\d+)\s*mm\s+(?:board|plank|wide|width)/i) ||
                     fullText.match(/available in.*?(\d+)\s*mm/i);
  if (widthMatch) plank_width_mm = parseFloat(widthMatch[1]);

  // Species & finish — product name usually contains "Oak Brushed and Oiled" etc
  const speciesFinish = productName;

  // Surface finish from product name or description
  const surface_finish = parseSurfaceFinish(productName + ' ' + description);

  // Lay pattern from product name or description
  const lay_pattern = parseLayPattern(productName + ' ' + fullText);

  // Installation method
  const installation_method = parseInstallation(fullText);

  // UFH
  const ufh_compatible = parseUFH(fullText);

  // Features
  const features = mapFeatures(fullText);
  if (ufh_compatible) features.push('insulation');
  if (/scratch resist|hard.wearing/i.test(fullText)) features.push('scratch');
  const uniqueFeatures = [...new Set(features)];

  // Rooms
  const rooms = mapHardFloorRooms(fullText);

  // Single product — one "colour" entry representing this product
  const colours = [{
    supplierName: productName,
    wycName:      productName,
    imgUrl:       null, // manual paste
    hex:          hexFromName(productName),
    colourFamily: colourFamilyFromName(productName),
  }];

  return {
    supplierName: productName,
    wycName:      productName,
    category:     'wood',
    imagesAuto:   false,
    specs: {
      description:          description || productName,
      features:             uniqueFeatures,
      rooms,
      dominantColourFamily: colourFamilyFromName(productName),
      durability:           4, // engineered wood = good durability
      // hard floor fields
      thickness_mm,
      wear_layer_mm,
      plank_width_mm,
      species_finish:       speciesFinish,
      surface_finish,
      lay_pattern,
      installation_method,
      ufh_compatible,
    },
    colours,
  };
}

module.exports = { domains: DOMAINS, category: 'wood', parse };
