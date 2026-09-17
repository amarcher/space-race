import test from 'node:test'
import assert from 'node:assert/strict'
import { createShippingQuotes, quotableAddress, type ShippingDetails } from '../src/shop/shipping-quotes.ts'
import { parcelForQuantity } from '../src/shop/constants.ts'

const address = (postal_code: string): ShippingDetails => ({
  name: 'Checkout Test',
  address: { line1: '1 Main St', city: 'Boston', state: 'MA', postal_code, country: 'US' },
})
const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('payment stays blocked until a real quote succeeds; duplicate events reuse it', async () => {
  const gate = deferred()
  let calls = 0
  const quotes = createShippingQuotes(async () => { ++calls; await gate.promise })
  assert.equal(quotes.ready(), false)
  quotes.setAddress(address('02108'))
  const first = quotes.refresh()
  const duplicate = quotes.refresh()
  assert.equal(quotes.ready(), false)
  gate.resolve()
  await Promise.all([first, duplicate])
  assert.equal(quotes.ready(), true)
  await quotes.refresh()
  assert.equal(calls, 1)
})

test('a slow old-address quote cannot authorize payment or overwrite the new quote', async () => {
  const old = deferred()
  const newer = deferred()
  const calls: string[] = []
  const quotes = createShippingQuotes(async (details) => {
    calls.push(details.address.postal_code!)
    await (calls.length === 1 ? old.promise : newer.promise)
  })
  quotes.setAddress(address('02108'))
  const pending = quotes.refresh()
  quotes.setAddress(address('10001'))
  const queued = quotes.refresh()
  assert.deepEqual(calls, ['02108'])
  old.resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(calls, ['02108', '10001'])
  assert.equal(quotes.ready(), false)
  newer.resolve()
  await Promise.all([pending, queued])
  assert.equal(quotes.ready(), true)
})

test('failed quotes block payment and wait for an explicit retry', async () => {
  let calls = 0
  const quotes = createShippingQuotes(async () => {
    if (++calls === 1) throw new Error('Carrier unavailable')
  })
  quotes.setAddress(address('02108'))
  await assert.rejects(quotes.refresh(), /Carrier unavailable/)
  assert.equal(quotes.ready(), false)
  await quotes.refresh()
  assert.equal(calls, 1)
  await quotes.refresh(true)
  assert.equal(calls, 2)
  assert.equal(quotes.ready(), true)
})

test('an incomplete address blocks payment even after an in-flight quote succeeds', async () => {
  const gate = deferred()
  const quotes = createShippingQuotes(() => gate.promise)
  quotes.setAddress(address('02108'))
  const pending = quotes.refresh()
  quotes.setAddress(null)
  gate.resolve()
  await pending
  assert.equal(quotes.ready(), false)
})

test('returning to a previous address after an intervening request requotes it', async () => {
  const gate = deferred()
  const calls: string[] = []
  const quotes = createShippingQuotes(async (details) => {
    calls.push(details.address.postal_code!)
    if (calls.length === 2) await gate.promise
  })
  quotes.setAddress(address('02108'))
  await quotes.refresh()
  quotes.setAddress(address('10001'))
  const pending = quotes.refresh()
  quotes.setAddress(address('02108'))
  gate.resolve()
  await pending
  assert.deepEqual(calls, ['02108', '10001', '02108'])
  assert.equal(quotes.ready(), true)
})

test('a failed stale address does not prevent a successful quote for the current address', async () => {
  const old = deferred()
  const calls: string[] = []
  const quotes = createShippingQuotes(async (details) => {
    calls.push(details.address.postal_code!)
    if (calls.length === 1) await old.promise
  })
  quotes.setAddress(address('02108'))
  const pending = quotes.refresh()
  quotes.setAddress(address('10001'))
  old.reject(new Error('Old address failed'))
  await pending
  assert.deepEqual(calls, ['02108', '10001'])
  assert.equal(quotes.ready(), true)
})

// Andrew reported an edited address keeping the previous address's rates on
// screen. These replay what ShopCheckout does on a change event — including
// that it only refreshes when the section reports complete — so that a future
// regression shows up here rather than in a customer's total.
const replayForm = (update: (details: ShippingDetails) => Promise<void>) => {
  const quotes = createShippingQuotes(update)
  return {
    quotes,
    async onChange(details: ShippingDetails | null) {
      quotes.setAddress(details)
      if (details) await quotes.refresh()
    },
  }
}

test('an address edited through an incomplete state requotes the new address', async () => {
  const calls: string[] = []
  const form = replayForm(async (details) => { calls.push(details.address.postal_code!) })
  await form.onChange(address('02108'))
  await form.onChange(null)
  assert.equal(form.quotes.ready(), false)
  await form.onChange(address('10001'))
  assert.deepEqual(calls, ['02108', '10001'])
  assert.equal(form.quotes.ready(), true)
})

test('an edit that lands back on the quoted address does not block payment', async () => {
  const calls: string[] = []
  const form = replayForm(async (details) => { calls.push(details.address.postal_code!) })
  await form.onChange(address('02108'))
  await form.onChange(null)
  await form.onChange(address('02108'))
  assert.deepEqual(calls, ['02108'])
  assert.equal(form.quotes.ready(), true)
})

test('a good address entered after a failed one quotes and unblocks payment', async () => {
  const calls: string[] = []
  const form = replayForm(async (details) => {
    calls.push(details.address.postal_code!)
    if (details.address.postal_code === '99999') throw new Error('No rates')
  })
  await assert.rejects(form.onChange(address('99999')))
  await form.onChange(null)
  await form.onChange(address('10001'))
  assert.deepEqual(calls, ['99999', '10001'])
  assert.equal(form.quotes.ready(), true)
})

// A rate depends on the postal address, never the recipient name, so a buyer
// who has typed an address but not yet their name still gets shipping shown.
test('a complete address quotes without a recipient name', () => {
  const details = quotableAddress({
    name: '',
    address: { line1: '1 Main St', city: 'Boston', state: 'MA', postal_code: '02108', country: 'US' },
  })
  assert.notEqual(details, null)
  assert.equal(details!.name, '')
  assert.equal(details!.address.postal_code, '02108')
})

test('adding the name later does not requote the same address', async () => {
  const calls: string[] = []
  const quotes = createShippingQuotes(async (details) => { calls.push(details.name) })
  const at = { line1: '1 Main St', city: 'Boston', state: 'MA', postal_code: '02108', country: 'US' }
  quotes.setAddress(quotableAddress({ name: '', address: at }))
  await quotes.refresh()
  quotes.setAddress(quotableAddress({ name: 'Checkout Test', address: at }))
  await quotes.refresh()
  assert.deepEqual(calls, [''])
  assert.equal(quotes.ready(), true)
})

test('half-typed addresses do not burn a quote', () => {
  const base = { line1: '1 Main St', city: 'Boston', state: 'MA', postal_code: '02108', country: 'US' }
  assert.equal(quotableAddress(null), null)
  assert.equal(quotableAddress({ name: 'A', address: { ...base, line1: '' } }), null)
  assert.equal(quotableAddress({ name: 'A', address: { ...base, city: '  ' } }), null)
  assert.equal(quotableAddress({ name: 'A', address: { ...base, state: '' } }), null)
  assert.equal(quotableAddress({ name: 'A', address: { ...base, postal_code: '021' } }), null)
  assert.equal(quotableAddress({ name: 'A', address: { ...base, country: 'CA' } }), null)
  assert.notEqual(quotableAddress({ name: 'A', address: { ...base, postal_code: '02108-1234' } }), null)
})

// Parcel dimensions feed live carrier quotes that customers are charged, so
// the box mapping is pinned rather than left to drift with an edit.
test('each order size ships in its own Uline box, at outside dimensions', () => {
  const one = parcelForQuantity(1)
  assert.deepEqual(one, { weightOz: 10.7, lengthIn: 4.375, widthIn: 4.375, heightIn: 3.625 })

  const two = parcelForQuantity(2)
  assert.deepEqual(two, { weightOz: 18.96, lengthIn: 4.375, widthIn: 4.375, heightIn: 4.625 })

  // The 3-copy box is wider, not taller — copies stand on edge side by side.
  const three = parcelForQuantity(3)
  assert.deepEqual(three, { weightOz: 27.38, lengthIn: 6.375, widthIn: 4.375, heightIn: 3.625 })
})

test('every quantity declares more weight than the old bubble-mailer model', () => {
  // Old model: 8.1 oz per copy + 1 oz of packaging for any order size.
  for (const copies of [1, 2, 3]) {
    const previous = 8.1 * copies + 1
    assert.ok(
      parcelForQuantity(copies).weightOz > previous,
      `${copies} copies must not be declared lighter than before (postage shortfall)`,
    )
  }
})

test('actual weight governs pricing — dim weight never exceeds it', () => {
  // UPS bills the greater of actual and dim weight (L*W*H/139, rounded up).
  for (const copies of [1, 2, 3]) {
    const p = parcelForQuantity(copies)
    const dimWeightLb = Math.ceil((p.lengthIn * p.widthIn * p.heightIn) / 139)
    const actualLb = Math.ceil(p.weightOz / 16)
    assert.ok(
      dimWeightLb <= actualLb,
      `${copies} copies: dim weight ${dimWeightLb}lb would govern over actual ${actualLb}lb`,
    )
  }
})

test('out-of-range quantities clamp to a real box rather than crashing', () => {
  assert.deepEqual(parcelForQuantity(0), parcelForQuantity(1))
  assert.deepEqual(parcelForQuantity(99), parcelForQuantity(3))
  assert.deepEqual(parcelForQuantity(2.7), parcelForQuantity(2))
})
