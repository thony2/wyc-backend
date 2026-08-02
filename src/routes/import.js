/**
 * ============================================================
 * West Yorkshire Carpets — Supplier Scraping & Import Routes
 *
 * Mounted at /api/panel in server.js. Migrated from routes/scraper.js
 * (5A consolidation, step 4 of 5 — see MASTER_CHECKLIST.md).
 * ============================================================
 */

'use strict';

const router  = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const importController = require('../controllers/importController');

router.use(requireAuth);

router.post('/scrape-family', importController.scrapeFamily);
router.post('/scrape-bulk',   importController.scrapeBulk);
router.post('/import-family', importController.importFamily);

module.exports = router;
