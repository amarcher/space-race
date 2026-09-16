import test from 'node:test'
import assert from 'node:assert/strict'
import { shippoOrderRequest } from '../api/_lib/shippo.ts'

test('a paid 3-copy order becomes a Shippo order with the paid-for service and packed weight', () => {
  const request = shippoOrderRequest({
    orderRef: 'ab12cd34',
    placedAt: new Date('2026-09-16T00:17:33Z'),
    productName: 'Space Race',
    quantity: 3,
    weightOz: 3 * 8.1 + 1,
    customerName: 'Pat Buyer',
    customerEmail: 'pat@example.com',
    customerPhone: null,
    address: { line1: '1 Main St', line2: null, city: 'Albany', state: 'NY', postal_code: '12207', country: 'US' },
    shippingService: 'UPS Ground Saver',
    shippingCents: 571,
    subtotalCents: 8637,
    taxCents: 0,
    totalCents: 9208,
  })

  assert.equal(request.order_status, 'PAID')
  assert.equal(request.placed_at, '2026-09-16T00:17:33.000Z')
  assert.equal(request.shipping_method, 'UPS Ground Saver')
  assert.equal(request.shipping_cost, '5.71')
  assert.equal(request.total_price, '92.08')
  assert.equal(request.weight, '25.3')
  assert.equal(request.line_items[0].quantity, 3)
  assert.deepEqual(request.to_address, {
    name: 'Pat Buyer', street1: '1 Main St', street2: '', city: 'Albany', state: 'NY',
    zip: '12207', country: 'US', email: 'pat@example.com',
  })
})
