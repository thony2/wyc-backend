/**
 * ============================================================
 * West Yorkshire Carpets — Public Product Routes
 *
 * Unauthenticated, mounted at /api/products in server.js.
 * Migrated from routes/products.js (5A consolidation, step 2 of 5 —
 * see MASTER_CHECKLIST.md).
 * ============================================================
 */

'use strict';

const router     = require('express').Router();
const controller = require('../controllers/productPublicController');

router.get('/',            controller.listProducts);
router.get('/categories',  controller.listCategories);
router.get('/deals',       controller.listDeals);
router.get('/:id/likes',   controller.getLikes);
router.post('/:id/like',   controller.toggleLike);

module.exports = router;
