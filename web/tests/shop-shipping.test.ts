import test from 'node:test'
import assert from 'node:assert/strict'
import { createShippingQuotes, type ShippingDetails } from '../src/shop/shipping-quotes.ts'

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
