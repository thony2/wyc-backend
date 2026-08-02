'use strict';

/**
 * Supplier plugin: Carpet Line Direct
 * carpetlinedirect.co.uk
 *
 * Full auto — images available in raw HTML.
 * One product per family, colours as variants.
 */

const cheerio = require('cheerio');
const {
  mapDurability, mapSoftness, mapCarpetStyle,
  mapFeatures, mapRooms,
  hexFromName, colourFamilyFromName, dominantColourFamily,
  normaliseFibre,
} = require('./helpers');

const DOMAINS = ['carpetlinedirect.co.uk'];

async function parse(html, url) {
  const $ = cheerio.load(html);

  // Family name
  const familyName =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  // Specs from bold labels
  const specs = {};
  $('strong, b').each((_, el) => {
    const key = $(el).text().replace(/:$/, '').trim().toLowerCase();
    const val = $(el).parent().text().replace($(el).text(), '').replace(/^:?\s*/, '').trim();
    if (key && val) specs[key] = val;
  });

  const suitability = specs['suitability'] || specs['suitable for'] || 'General Domestic';
  const pileWeight  = specs['pile weight'] || specs['pile content weight'] || '';
  const fibreRaw    = specs['pile content'] || specs['pile composition'] || specs['fibre'] || specs['content'] || '';

  // Accumulate text for feature/room mapping
  let featText = Object.values(specs).join(' ');
  let roomText = Object.values(specs).join(' ');
  $('p, li, td').each((_, el) => {
    const t = $(el).text();
    if (/bleach|stain|clean|underfloor|pet|soft|luxurious|waterproof|scratch/i.test(t)) featText += ' ' + t;
    if (/living|bedroom|dining|kitchen|bathroom|hall|stair|landing|lounge/i.test(t)) roomText += ' ' + t;
  });

  // Colours — CLD uses figure/figcaption pattern
  const colours = [];
  const seen = new Set();
  $('figure').each((_, el) => {
    const anchor  = $(el).find('a').first();
    const img     = $(el).find('img').first();
    const caption = $(el).find('figcaption').text().trim();
    let imgUrl    = anchor.attr('href') || img.attr('src') || '';
    imgUrl = imgUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');
    if (imgUrl && !imgUrl.startsWith('http')) imgUrl = 'https://www.carpetlinedirect.co.uk' + imgUrl;
    if (!imgUrl || !caption) return;
    if (!/\.(jpe?g|png|webp)/i.test(imgUrl)) return;
    if (/icons|logo|banner|CLD-Web|CLD-Master/i.test(imgUrl)) return;
    if (seen.has(imgUrl)) return;
    seen.add(imgUrl);
    colours.push({ supplierName: caption, imgUrl });
  });

  // Fallback
  if (colours.length === 0) {
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const name = $(el).find('img').attr('alt') || $(el).next().text().trim();
      if (!/\.(jpe?g|png|webp)/i.test(href)) return;
      if (/icons|logo|banner/i.test(href)) return;
      if (!name || seen.has(href)) return;
      seen.add(href);
      colours.push({ supplierName: name, imgUrl: href });
    });
  }

  const enriched = colours.map(c => ({
    supplierName:  c.supplierName,
    wycName:       c.supplierName,
    imgUrl:        c.imgUrl,
    hex:           hexFromName(c.supplierName),
    colourFamily:  colourFamilyFromName(c.supplierName),
  }));

  const description = `${familyName} — ${suitability}. ${pileWeight} pile weight.`
    .replace(/\s{2,}/g, ' ').trim();

  return {
    supplierName: familyName,
    wycName:      familyName,
    category:     'carpets',
    imagesAuto:   true,
    specs: {
      fibre:                normaliseFibre(fibreRaw),
      pileWeight,
      suitability,
      carpetStyle:          mapCarpetStyle(familyName),
      durability:           mapDurability(suitability),
      softness:             mapSoftness(suitability),
      description,
      features:             mapFeatures(featText),
      rooms:                mapRooms(roomText),
      dominantColourFamily: dominantColourFamily(enriched),
    },
    colours: enriched,
  };
}

module.exports = { domains: DOMAINS, category: 'carpets', parse };
