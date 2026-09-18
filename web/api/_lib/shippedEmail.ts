import { Resend } from 'resend'
import { sql } from './db.js'
import { renderShippedNotice } from './orderEmail.js'
import { PRODUCT_NAME } from '../../src/shop/constants.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export type ShippedEmailResult = { sent: true } | { sent: false; reason: string }

/** Emails the buyer their tracking number, once, for a shipped order.
 *
 *  Never throws: the order is already marked shipped by the time this runs,
 *  and a mail failure must not make that look like it didn't happen. The
 *  caller reports the reason instead, and /shop/admin offers a retry.
 */
export async function sendShippedEmail(orderId: string): Promise<ShippedEmailResult> {
  try {
    const [order] = await sql`
      select id, customer_email, customer_name, shipping_address, quantity,
        shipping_service, tracking_number, shipped_email_sent_at
      from orders
      where id = ${orderId} and status = 'fulfilled'
    `
    if (!order) return { sent: false, reason: 'Order is not marked shipped' }
    if (order.shipped_email_sent_at) return { sent: false, reason: 'Shipping email was already sent' }
    if (!order.tracking_number) return { sent: false, reason: 'Order has no tracking number' }
    if (!order.customer_email) return { sent: false, reason: 'Order has no customer email' }
    if (!resend) return { sent: false, reason: 'RESEND_API_KEY is not configured' }

    const email = renderShippedNotice({
      productName: PRODUCT_NAME,
      quantity: order.quantity,
      customerName: order.customer_name,
      address: order.shipping_address ?? {},
      shippingService: order.shipping_service,
      trackingNumber: order.tracking_number,
      orderRef: String(order.id).slice(0, 8),
    })
    const result = await resend.emails.send({
      from: 'Space Race <orders@spaceexplorer.tech>',
      to: order.customer_email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    if (result.error) {
      console.error('Shipped email rejected by Resend', { orderId, error: result.error })
      return { sent: false, reason: result.error.message }
    }

    await sql`update orders set shipped_email_sent_at = now() where id = ${orderId}`
    return { sent: true }
  } catch (err) {
    console.error('Shipped email failed to send', { orderId, err })
    return { sent: false, reason: err instanceof Error ? err.message : 'Unknown error' }
  }
}
