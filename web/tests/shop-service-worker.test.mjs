import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

// Inspect the generated worker, not just configuration: plugin defaults change
// when injectRegister is disabled and previously defeated registerType:autoUpdate.
test('built worker activates updates and never serves a cached commerce page', () => {
  let manifest
  let denylist
  let skipsWaiting = false
  let claimsClients = false
  class Stub { constructor() {} }
  const workbox = {
    precacheAndRoute(entries) { manifest = entries },
    cleanupOutdatedCaches() {},
    clientsClaim() { claimsClients = true },
    createHandlerBoundToURL() {},
    NavigationRoute: class { constructor(_handler, options) { denylist = options.denylist } },
    registerRoute() {},
    CacheFirst: Stub, StaleWhileRevalidate: Stub, RangeRequestsPlugin: Stub,
    ExpirationPlugin: Stub, CacheableResponsePlugin: Stub,
  }
  const define = (_dependencies, factory) => factory(workbox)
  vm.runInNewContext(fs.readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8'), {
    define,
    self: { define, skipWaiting() { skipsWaiting = true }, addEventListener() {} },
  })
  assert.equal(skipsWaiting, true, 'new worker must not wait for all game tabs to close')
  assert.equal(claimsClients, true)
  assert.ok(manifest.some(({ url }) => url === 'index.html'), 'game stays available offline')
  assert.ok(!manifest.some(({ url }) => ['shop.html', 'shop-admin.html'].includes(url)))
  for (const path of ['/shop', '/shop/', '/shop.html', '/shop.html?session_id=cs_test_example', '/shop/admin', '/shop/admin/', '/shop-admin.html']) {
    const pathname = new URL(path, 'https://example.com').pathname
    assert.ok(denylist.some((pattern) => pattern.test(pathname)), `${path} must use the network`)
  }
  assert.ok(!denylist.some((pattern) => pattern.test('/')), 'game navigation keeps its offline fallback')
})
