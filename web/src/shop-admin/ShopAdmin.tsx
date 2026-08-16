import { useCallback, useEffect, useState } from 'react'

const SECRET_STORAGE_KEY = 'shop-admin-secret'

type ShippingAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

type Order = {
  id: string
  created_at: string
  customer_email: string
  customer_name: string | null
  shipping_address: ShippingAddress
  quantity: number
  // What the buyer picked and paid for at checkout — the service the parcel
  // has to actually go out by.
  shipping_service: string | null
  shipping_cents: number
  amount_total_cents: number
  currency: string
  status: 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
  tracking_number: string | null
  fulfilled_at: string | null
  notes: string | null
  ship_window: 'early' | 'january'
}

function formatAddress(a: ShippingAddress) {
  return [
    a.line1,
    a.line2,
    // "Lexington, MA 02420" — comma after the city only, space before the ZIP.
    [[a.city, a.state].filter(Boolean).join(', '), a.postal_code].filter(Boolean).join(' '),
    a.country && a.country !== 'US' ? a.country : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function formatMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() })
}

async function callAdminApi(path: string, secret: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${secret}` },
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`)
  return res.json()
}

function FulfillForm({ order, secret, onFulfilled }: { order: Order; secret: string; onFulfilled: () => void }) {
  const [tracking, setTracking] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!tracking.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await callAdminApi('/api/admin/fulfill', secret, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, trackingNumber: tracking.trim() }),
      })
      onFulfilled()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark fulfilled')
    } finally {
      setSubmitting(false)
    }
  }, [tracking, secret, order.id, onFulfilled])

  return (
    <div className="admin__fulfill">
      <input
        type="text"
        placeholder="Tracking number"
        value={tracking}
        onChange={(e) => setTracking(e.target.value)}
        disabled={submitting}
      />
      <button onClick={submit} disabled={submitting || !tracking.trim()}>
        Mark shipped
      </button>
      {error && <span className="admin__error">{error}</span>}
    </div>
  )
}

function OrderRow({ order, secret, onChanged }: { order: Order; secret: string; onChanged: () => void }) {
  return (
    <tr className={`admin__row admin__row--${order.status}`}>
      <td>{new Date(order.created_at).toLocaleDateString()}</td>
      <td>
        {order.customer_name ?? '—'}
        <br />
        <span className="admin__dim">{order.customer_email}</span>
      </td>
      <td>{formatAddress(order.shipping_address)}</td>
      <td>{order.quantity}</td>
      <td>{order.ship_window}</td>
      <td>
        {order.shipping_service ?? '—'}
        <br />
        <span className="admin__dim">{formatMoney(order.shipping_cents, order.currency)} paid</span>
      </td>
      <td>{formatMoney(order.amount_total_cents, order.currency)}</td>
      <td>{order.status}</td>
      <td>
        {order.status === 'paid' && <FulfillForm order={order} secret={secret} onFulfilled={onChanged} />}
        {order.status === 'fulfilled' && (order.tracking_number ?? '—')}
      </td>
    </tr>
  )
}

export function ShopAdmin() {
  const [secret, setSecret] = useState<string | null>(() => sessionStorage.getItem(SECRET_STORAGE_KEY))
  const [secretInput, setSecretInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (currentSecret: string) => {
    setLoadError(null)
    try {
      const data = await callAdminApi('/api/admin/orders', currentSecret)
      setOrders(data.orders)
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        sessionStorage.removeItem(SECRET_STORAGE_KEY)
        setSecret(null)
        setAuthError('Wrong secret')
        return
      }
      setLoadError(err instanceof Error ? err.message : 'Failed to load orders')
    }
  }, [])

  useEffect(() => {
    if (secret) load(secret)
  }, [secret, load])

  const submitSecret = useCallback(() => {
    if (!secretInput.trim()) return
    sessionStorage.setItem(SECRET_STORAGE_KEY, secretInput.trim())
    setAuthError(null)
    setSecret(secretInput.trim())
  }, [secretInput])

  if (!secret) {
    return (
      <main className="admin admin--gate">
        <h1>Space Race — Order Fulfillment</h1>
        <input
          type="password"
          placeholder="Admin secret"
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitSecret()}
        />
        <button onClick={submitSecret}>Unlock</button>
        {authError && <p className="admin__error">{authError}</p>}
      </main>
    )
  }

  return (
    <main className="admin">
      <h1>Space Race — Order Fulfillment</h1>
      {loadError && <p className="admin__error">{loadError}</p>}
      {!orders && !loadError && <p>Loading…</p>}
      {orders && (
        // The table is wider than any phone screen — scope the scroll to this
        // wrapper (not the page) so a swipe across the data doesn't drag the
        // whole document sideways with it.
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Address</th>
                <th>Qty</th>
                <th>Window</th>
                <th>Ship via</th>
                <th>Total</th>
                <th>Status</th>
                <th>Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} secret={secret} onChanged={() => load(secret)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
