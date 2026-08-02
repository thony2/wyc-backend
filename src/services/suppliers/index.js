'use strict';

/**
 * routes/suppliers/index.js
 *
 * Supplier plugin registry. Each plugin exports:
 *   - domains:   string[]  — URL domains this plugin handles
 *   - category:  string | null — fixed category, or null if multi-category
 *   - parse(html, url): Promise<ScrapedFamily>
 *
 * ScrapedFamily shape:
 * {
 *   supplierName: string,       // raw name from supplier
 *   wycName:      string,       // pre-filled (editable in UI)
 *   category:     string,       // carpets | vinyl | laminate | wood
 *   imagesAuto:   boolean,      // true = images downloaded automatically
 *   specs: {
 *     fibre?:               string,
 *     pileWeight?:          string,
 *     suitability?:         string,
 *     carpetStyle?:         string,
 *     durability:           number,
 *     softness?:            number,
 *     description:          string,
 *     features:             string[],
 *     rooms:                string[],
 *     dominantColourFamily: string,
 *     // hard floor fields
 *     thickness_mm?:        number,
 *     wear_layer_mm?:       number,
 *     ac_rating?:           string,
 *     board_design?:        string,
 *     plank_width_mm?:      number,
 *     species_finish?:      string,
 *     surface_finish?:      string,
 *     lay_pattern?:         string,
 *     installation_method?: string,
 *     ufh_compatible?:      number,
 *   },
 *   colours: [{
 *     supplierName:  string,
 *     wycName:       string,
 *     imgUrl:        string | null,   // null = needs manual paste
 *     hex:           string,
 *     colourFamily:  string,
 *   }]
 * }
 */

const cld       = require('./cld');
const victoria  = require('./victoria');
const cormar    = require('./cormar');
const woodpecker = require('./woodpecker');
const karndean  = require('./karndean');
const quickstep = require('./quickstep');

const PLUGINS = [cld, victoria, cormar, woodpecker, karndean, quickstep];

/**
 * Detect which plugin handles this URL.
 * Returns the plugin or null if unknown.
 */
function detectPlugin(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return PLUGINS.find(p => p.domains.some(d => host === d || host.endsWith('.' + d))) || null;
  } catch {
    return null;
  }
}

module.exports = { detectPlugin, PLUGINS };
