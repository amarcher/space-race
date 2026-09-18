import test from 'node:test'
import assert from 'node:assert/strict'
import { renderShippedNotice, trackingUrl } from '../api/_lib/orderEmail.ts'

const base = {
  productName: 'Space Race: 1000 Light-Years — First Edition',
  quantity: 3,
  customerName: 'Pat Recipient',
  address: { line1: '14 E 90th St', city: 'New York', state: 'NY', postal_code: '10128', country: 'US' },
  shippingService: 'UPS Ground Saver',
  trackingNumber: '1Z999AA10123456784',
  orderRef: 'aeaa04f3',
}

test('each carrier the store sells links to its own tracking page', () => {
  assert.equal(trackingUrl('UPS Ground Saver', '1Z999AA10123456784'), 'https://www.ups.com/track?tracknum=1Z999AA10123456784')
  assert.equal(trackingUrl('USPS Ground Advantage', '9400 1000'), 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201000')
  assert.equal(trackingUrl('FedEx Ground', '1234'), 'https://www.fedex.com/fedextrack/?trknbr=1234')
  // A 1Z number is UPS whatever the service says.
  assert.equal(trackingUrl(null, '1Z999AA10123456784'), 'https://www.ups.com/track?tracknum=1Z999AA10123456784')
})

test('an unknown carrier gets no link rather than a guessed one', () => {
  assert.equal(trackingUrl('Hand delivered', 'ABC123'), null)
  const email = renderShippedNotice({ ...base, shippingService: null, trackingNumber: 'ABC123' })
  assert.ok(!email.html.includes('Track your package'))
  assert.ok(email.html.includes('ABC123'))
})

test('the shipped email names the copies, carrier, tracking and address', () => {
  const email = renderShippedNotice(base)
  assert.equal(email.subject, 'Your Space Race order has shipped')
  for (const part of ['Your 3 copies', 'via UPS Ground Saver', '1Z999AA10123456784', 'ups.com/track', 'Pat Recipient', 'New York, NY 10128', 'Order aeaa04f3']) {
    assert.ok(email.html.includes(part), `html missing ${part}`)
    assert.ok(email.text.includes(part) || part === 'ups.com/track', `text missing ${part}`)
  }
  assert.ok(renderShippedNotice({ ...base, quantity: 1 }).text.startsWith('Your copy of'))
})

test('buyer-supplied text is escaped', () => {
  const email = renderShippedNotice({ ...base, customerName: '<b>Pat</b>' })
  assert.ok(email.html.includes('&lt;b&gt;Pat&lt;/b&gt;'))
  assert.ok(!email.html.includes('<b>Pat</b>'))
})
