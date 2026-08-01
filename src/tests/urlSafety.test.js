'use strict';

// Unit tests for src/utils/urlSafety.js — the SSRF guard used before
// routes/scraper.js downloads a user-supplied image URL. Pure logic, no
// database and no real network access needed: IP-literal hostnames (like
// 127.0.0.1) are resolved by dns.lookup() without an actual DNS query, so
// these run the same offline as they would in CI.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { assertSafeExternalUrl } = require('../utils/urlSafety');

describe('assertSafeExternalUrl', () => {
    test('rejects loopback addresses', async () => {
        await assert.rejects(() => assertSafeExternalUrl('http://127.0.0.1/image.jpg'));
    });

    test('rejects the link-local range used for cloud metadata endpoints', async () => {
        await assert.rejects(() => assertSafeExternalUrl('http://169.254.169.254/latest/meta-data/'));
    });

    test('rejects private LAN ranges (10.x, 172.16-31.x, 192.168.x)', async () => {
        await assert.rejects(() => assertSafeExternalUrl('http://10.0.0.5/image.jpg'));
        await assert.rejects(() => assertSafeExternalUrl('http://172.16.0.1/image.jpg'));
        await assert.rejects(() => assertSafeExternalUrl('http://192.168.1.1/image.jpg'));
    });

    test('rejects "localhost" by name', async () => {
        await assert.rejects(() => assertSafeExternalUrl('http://localhost:5432/'));
    });

    test('rejects non-http(s) schemes', async () => {
        await assert.rejects(() => assertSafeExternalUrl('file:///etc/passwd'));
    });

    test('rejects malformed URLs', async () => {
        await assert.rejects(() => assertSafeExternalUrl('not a url'));
    });

    test('accepts a normal public IPv4 address', async () => {
        // 8.8.8.8 (Google DNS) is a stable, well-known public address —
        // used here purely as "a real, public, non-private IPv4 literal",
        // not because this test contacts it.
        await assert.doesNotReject(() => assertSafeExternalUrl('http://8.8.8.8/image.jpg'));
    });
});
