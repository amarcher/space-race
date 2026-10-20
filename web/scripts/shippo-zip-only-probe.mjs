#!/usr/bin/env node
// Does Shippo quote USPS rates from city/state/ZIP alone, with no street line?
//
// This is the question that decides whether Apple Pay / Google Pay are worth
// building (web/docs/wallet-payments-scope.md): those wallets hand over only
// {city, state, postal_code, country} before the buyer authorises payment.
//
// Run:  SHIPPO_API_TOKEN=... node shippo-zip-only-probe.mjs
// Get the token:  cd web && npx vercel env pull .env.probe   (then source it)

const TOKEN = process.env.SHIPPO_API_TOKEN
if (!TOKEN) {
  console.error('Set SHIPPO_API_TOKEN first. Nothing was sent.')
  process.exit(1)
}

const FROM = {
  name: 'Space Race',
  street1: '137 Woburn Street',
  city: 'Lexington',
  state: 'MA',
  zip: '02420',
  country: 'US',
}

// Matches parcelForQuantity(1) in web/src/shop/constants.ts.
const PARCEL = {
  length: '3.55', width: '2.55', height: '1.75',
  distance_unit: 'in', weight: '9.1', mass_unit: 'oz',
}

const DESTINATIONS = [
  { label: 'New York NY', city: 'New York', state: 'NY', zip: '10001', street1: '350 Fifth Avenue' },
  { label: 'San Francisco CA', city: 'San Francisco', state: 'CA', zip: '94103', street1: '1355 Market St' },
  { label: 'Boston MA', city: 'Boston', state: 'MA', zip: '02108', street1: '1 Beacon St' },
]

async function quote(to) {
  const response = await fetch('https://api.goshippo.com/shipments/', {
    method: 'POST',
    headers: { Authorization: `ShippoToken ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ address_from: FROM, address_to: to, parcels: [PARCEL], async: false }),
  })
  if (!response.ok) {
    return { error: `HTTP ${response.status} ${(await response.text()).slice(0, 200)}` }
  }
  const body = await response.json()
  const rates = (body.rates ?? [])
    .filter((r) => r.amount)
    .map((r) => `${r.provider} ${r.servicelevel?.name ?? ''}`.trim() + ` $${r.amount}`)
    .sort()
  return { rates, messages: (body.messages ?? []).map((m) => m.text).slice(0, 3) }
}

for (const d of DESTINATIONS) {
  const withStreet = { name: '', street1: d.street1, city: d.city, state: d.state, zip: d.zip, country: 'US' }
  // What a wallet gives us: no street line at all.
  const zipOnly = { name: '', city: d.city, state: d.state, zip: d.zip, country: 'US' }

  const [full, partial] = await Promise.all([quote(withStreet), quote(zipOnly)])

  console.log(`\n=== ${d.label} ===`)
  console.log('  with street :', full.error ?? `${full.rates.length} rates`)
  for (const r of full.rates ?? []) console.log('      ', r)
  console.log('  ZIP only    :', partial.error ?? `${partial.rates.length} rates`)
  for (const r of partial.rates ?? []) console.log('      ', r)
  if (partial.messages?.length) console.log('  messages    :', partial.messages)

  if (!full.error && !partial.error) {
    const same = JSON.stringify(full.rates) === JSON.stringify(partial.rates)
    console.log(`  VERDICT     : ${partial.rates.length === 0 ? 'NO RATES — wallets are not viable'
      : same ? 'identical rates — wallets viable' : 'rates DIFFER — check which we would be committing to'}`)
  }
}
