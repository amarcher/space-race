import test from 'node:test'
import assert from 'node:assert/strict'
import { availableInventory, CURRENT_SHIP_WINDOW, resolveShipWindow, shippingConfirmationLine } from '../src/shop/constants.ts'
import { renderOrderConfirmation } from '../api/_lib/orderEmail.ts'

test('new orders are in stock while old sessions keep their fulfillment promises', () => {
  assert.equal(CURRENT_SHIP_WINDOW, 'in_stock')
  assert.equal(resolveShipWindow('in_stock'), 'in_stock')
  assert.equal(resolveShipWindow('early'), 'early')
  assert.equal(resolveShipWindow('january'), 'january')
  assert.equal(resolveShipWindow(undefined), 'january')
  assert.equal(resolveShipWindow('unexpected'), 'january')
  assert.match(shippingConfirmationLine('early'), /September 10th/)
  assert.match(shippingConfirmationLine('january'), /mid-January 2027/)
})

test('available-now receipts contain no pre-order or delayed-batch copy and retain totals', () => {
  const receipt = renderOrderConfirmation({ productName: 'Space Race', quantity: 2, unitPriceCents: 2879,
    subtotalCents: 5758, shippingCents: 583, shippingService: 'USPS Ground Advantage', taxCents: 0,
    totalCents: 6341, customerName: 'Example', address: { city: 'New York', country: 'US' },
    shipDateLine: shippingConfirmationLine('in_stock'), orderRef: 'example' })
  assert.equal(receipt.subject, 'Your Space Race order is confirmed')
  assert.doesNotMatch([receipt.subject, receipt.text, receipt.html].join('\n'), /pre.?order|September|January|ship window/i)
  assert.match(receipt.text, /\$57\.58/)
  assert.match(receipt.text, /\$5\.83/)
  assert.match(receipt.text, /\$63\.41/)
  assert.match(receipt.text, /tracking info when your order ships/)
})


test('only on-hand stock is sold, with historical allocations and reserves respected', () => {
  assert.equal(availableInventory(0, 0), 10)
  assert.equal(availableInventory(9, 9), 1)
  assert.equal(availableInventory(10, 10), 0)
  assert.equal(availableInventory(11, 11), 0)
  assert.equal(availableInventory(95, 0), 10)
  assert.equal(availableInventory(104, 0), 1)
  assert.equal(availableInventory(105, 0), 0)
})
