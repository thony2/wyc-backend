'use strict';

/**
 * src/utils/urlSafety.js
 *
 * Guards against SSRF (Server-Side Request Forgery): a request that asks
 * *this server* to fetch a URL on the caller's behalf, aimed at an internal
 * address the caller couldn't reach directly (localhost, the private LAN,
 * or a cloud metadata endpoint like 169.254.169.254, which many cloud
 * providers use to serve credentials to their own servers).
 *
 * Used before any server-initiated fetch of a user-supplied URL — currently
 * just the image-download step in routes/scraper.js's /import-family.
 *
 * Known limitation: this checks the IP the hostname resolves to *before*
 * the request is made. It does not protect against a redirect (or DNS
 * record that changes between this check and the actual request) pointing
 * to a private address afterwards. Closing that fully means either
 * disabling redirects entirely or validating the IP of every hop, which
 * isn't done here yet — worth revisiting if this endpoint's trust model
 * ever widens beyond "JWT-admin-only".
 */

const dns = require('dns').promises;
const net = require('net');

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true; // malformed → treat as unsafe

    const [a, b] = parts;
    if (a === 10) return true;                           // 10.0.0.0/8         private
    if (a === 127) return true;                           // 127.0.0.0/8        loopback
    if (a === 169 && b === 254) return true;               // 169.254.0.0/16     link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12      private
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16     private
    if (a === 100 && b >= 64 && b <= 127) return true;      // 100.64.0.0/10      carrier-grade NAT
    if (a === 0) return true;                              // 0.0.0.0/8          "this network"
    if (a >= 224) return true;                             // 224.0.0.0/4+       multicast / reserved
    return false;
}

function isPrivateIPv6(ip) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;                      // loopback
    if (lower.startsWith('fe80:')) return true;             // fe80::/10   link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — unwrap and re-check as IPv4
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return false;
}

function isPrivateIP(ip) {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);
    return true; // couldn't tell what it is → treat as unsafe
}

/**
 * Throws if `urlString` is not safe for this server to fetch.
 * Resolves on success (nothing to return — absence of a throw is the pass).
 */
async function assertSafeExternalUrl(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error('Not a valid URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported URL scheme "${parsed.protocol}" — only http/https are allowed.`);
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Requests to localhost are not allowed.');
    }

    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true });
    } catch {
        throw new Error(`Could not resolve hostname "${hostname}".`);
    }

    if (addresses.length === 0) {
        throw new Error(`Hostname "${hostname}" did not resolve to any address.`);
    }

    for (const { address } of addresses) {
        if (isPrivateIP(address)) {
            throw new Error(`Refusing to fetch "${hostname}" — resolves to a private/internal address.`);
        }
    }
}

module.exports = { assertSafeExternalUrl };
