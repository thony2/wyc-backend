'use strict';

/**
 * Supplier plugin: Cormar Carpets
 * cormarcarpets.co.uk
 *
 * Semi-auto — all text data scraped, images need manual paste.
 * Colour names extracted from variant links in HTML.
 */

const cheerio = require('cheerio');
const {
  mapDurability, mapSoftness, mapCarpetStyle,
  mapFeatures, mapRooms,
  hexFromName, colourFamilyFromName, dominantColourFamily,
  normaliseFibre,
} = require('./helpers');

const DOMAINS = ['cormarcarpets.co.uk'];

async function parse(html, url) {
  const $ = cheerio.load(html);

  // Family name from h1
  const familyName = $('h1').first().text().trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  // Description — first meaningful paragraph
  let description = '';
  $('p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 40 && !description) description = t;
  });
  if (!description) description = familyName;

  const fullText = $('body').text();

  // Fibre — Cormar puts it in the h2 subtitle: "Made from 100% X and suitable for Y"
  let fibreRaw = '';
  let suitability = 'General Domestic';
  $('h2').each((_, el) => {
    const t = $(el).text();
    const fibreM = t.match(/made from\s+(.+?)\s+and suitable/i);
    if (fibreM) fibreRaw = fibreM[1].trim();
    const suitM = t.match(/suitable for\s+(.+?)(?:\s+use|\s*available|$)/i);
    if (suitM) suitability = suitM[1].trim();
  });

  // Fallback suitability from full text
  if (suitability === 'General Domestic') {
    if (/extra heavy domestic/i.test(fullText)) suitability = 'Extra Heavy Domestic';
    else if (/heavy domestic/i.test(fullText))  suitability = 'Heavy Domestic';
    else if (/general domestic/i.test(fullText)) suitability = 'General Domestic';
    else if (/light domestic/i.test(fullText))   suitability = 'Light Domestic';
  }

  // Colours — Cormar lists colours as links: /variants/colour-name/
  const colours = [];
  const seen = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes('/variants/')) return;
    // Extract colour name from the link text or from the URL
    let name = $(el).text().trim();
    if (!name) {
      const parts = href.split('/');
      const variantSlug = parts[parts.indexOf('variants') + 1];
      if (variantSlug) name = variantSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    if (!name || seen.has(name)) return;
    seen.add(name);
    colours.push({
      supplierName: name,
      wycName:      name,
      imgUrl:       null, // manual paste required
      hex:          hexFromName(name),
      colourFamily: colourFamilyFromName(name),
    });
  });

  const descFull = `${familyName} — ${suitability}. ${description}`.substring(0, 200);

  return {
    supplierName: familyName,
    wycName:      familyName,
    category:     'carpets',
    imagesAuto:   false,
    specs: {
      fibre:                normaliseFibre(fibreRaw),
      suitability,
      carpetStyle:          mapCarpetStyle(familyName),
      durability:           mapDurability(suitability),
      softness:             mapSoftness(suitability),
      description:          descFull,
      features:             mapFeatures(fullText),
      rooms:                mapRooms(fullText),
      dominantColourFamily: colours.length > 0 ? dominantColourFamily(colours) : 'neutrals',
    },
    colours,
  };
}

module.exports = { domains: DOMAINS, category: 'carpets', parse };
