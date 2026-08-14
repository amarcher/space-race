// Transactional email templates for the store.
//
// Kept out of the webhook handler so the markup can be rendered and eyeballed
// without a Stripe event, and so later emails (shipment/tracking, delay
// notices) can reuse the same shell.
//
// Email HTML is not web HTML: no external stylesheet, no flexbox/grid worth
// trusting, and Outlook still renders through Word. So this is tables +
// inline styles, one 600px column, and nothing load-bearing inside an image —
// most clients block images until the reader opts in.

const SITE = 'https://game.spaceexplorer.tech'
const SUPPORT_EMAIL = 'orders@spaceexplorer.tech'

// Same palette as the shop page (web/src/shop/Shop.css).
const BG = '#07071a'
const PANEL = '#12122b'
const INSET = '#0d0d22'
const BORDER = '#23234a'
const GOLD = '#ffd93d'
const TEXT = '#e8e6df'
const DIM = '#a6a4b8'

const DISPLAY_FONT = `'Unbounded','Trebuchet MS','Segoe UI',system-ui,sans-serif`
const BODY_FONT = `'Inter','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif`

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type EmailAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export function addressLines(address: EmailAddress, name: string | null): string[] {
  return [
    name,
    address.line1,
    address.line2,
    // "Lexington, MA 02420" — comma after the city only, space before the ZIP.
    [[address.city, address.state].filter(Boolean).join(', '), address.postal_code].filter(Boolean).join(' '),
    // Only worth stating when it isn't the one country we ship to today.
    address.country && address.country !== 'US' ? address.country : null,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

type ReceiptRow = { label: string; amount: number }

export type OrderConfirmationInput = {
  productName: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  shippingCents: number
  shippingService: string | null
  taxCents: number
  totalCents: number
  customerName: string | null
  address: EmailAddress
  shipDateLine: string
  /** Short human-quotable id for support ("about order 3f2a1b9c"). */
  orderRef: string
}

function receiptRows(input: OrderConfirmationInput): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    { label: `Pre-order — ${input.quantity} × ${money(input.unitPriceCents)}`, amount: input.subtotalCents },
    {
      label: input.shippingService ? `Shipping (${input.shippingService})` : 'Shipping',
      amount: input.shippingCents,
    },
  ]
  // Omitted rather than shown as $0.00 — outside a registered state there's no
  // tax to report, and the remaining lines still sum to the total.
  if (input.taxCents > 0) rows.push({ label: 'Sales tax', amount: input.taxCents })
  return rows
}

/** The chrome every transactional email shares: dark shell, masthead, footer. */
function shell({ title, preheader, body }: { title: string; preheader: string; body: string }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Tells clients this design is already dark, so they don't invert it. -->
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<style>
  /* Webfont loads in Apple Mail / iOS; everywhere else the stack below it
     (Trebuchet, Segoe UI) keeps the geometric feel without a download. */
  @font-face{font-family:'Unbounded';src:url('${SITE}/fonts/unbounded-700.woff2') format('woff2');font-weight:700;font-display:swap}
  @font-face{font-family:'Inter';src:url('${SITE}/fonts/inter-600.woff2') format('woff2');font-weight:400 700;font-display:swap}
  body{margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%}
  a{color:${GOLD}}
  @media only screen and (max-width:620px){
    .sr-container{width:100%!important}
    .sr-pad{padding-left:22px!important;padding-right:22px!important}
    .sr-total{font-size:22px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};">
<!-- Preheader: the grey line clients show after the subject. The spacer stops
     them pulling body copy in after it. -->
<div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BG};">${escapeHtml(preheader)}&nbsp;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};width:100%;">
<tr><td align="center" style="padding:32px 12px 44px;">
<table role="presentation" class="sr-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${PANEL};border:1px solid ${BORDER};border-radius:16px;">
  <tr><td class="sr-pad" style="padding:30px 34px 22px;border-bottom:1px solid ${BORDER};">
    <div style="font-family:${DISPLAY_FONT};font-size:21px;font-weight:700;color:${GOLD};letter-spacing:.01em;line-height:1.1;">SPACE RACE</div>
    <div style="font-family:${BODY_FONT};font-size:11px;color:${DIM};letter-spacing:.18em;text-transform:uppercase;padding-top:6px;">1000 Light-Years</div>
  </td></tr>
  ${body}
  <tr><td class="sr-pad" style="padding:22px 34px 30px;border-top:1px solid ${BORDER};font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${DIM};">
    Questions about your order? Just reply to this email, or reach us at
    <a href="mailto:${SUPPORT_EMAIL}" style="color:${GOLD};">${SUPPORT_EMAIL}</a>.
    <div style="padding-top:10px;">
      <a href="${SITE}" style="color:${DIM};text-decoration:underline;">Play free online</a>
      &nbsp;·&nbsp;
      <a href="${SITE}/shop" style="color:${DIM};text-decoration:underline;">The shop</a>
    </div>
    <div style="padding-top:10px;color:#6f6d84;">You're receiving this because you pre-ordered from ${SITE.replace('https://', '')}.</div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function renderOrderConfirmation(input: OrderConfirmationInput) {
  const rows = receiptRows(input)
  const ship = addressLines(input.address, input.customerName)

  const labelCell = `font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${TEXT};padding:9px 0;`
  const amountCell = `${labelCell}text-align:right;white-space:nowrap;`

  const rowsHtml = rows
    .map(
      (row) =>
        `<tr><td style="${labelCell}">${escapeHtml(row.label)}</td>` +
        `<td style="${amountCell}">${escapeHtml(money(row.amount))}</td></tr>`,
    )
    .join('\n')

  const body = `
  <tr><td class="sr-pad" style="padding:30px 34px 4px;">
    <div style="font-family:${DISPLAY_FONT};font-size:24px;font-weight:700;color:${TEXT};line-height:1.25;">You're in!</div>
    <div style="font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${DIM};padding-top:12px;">
      Thanks for pre-ordering <span style="color:${TEXT};">${escapeHtml(input.productName)}</span>.
      Here's exactly what you paid for.
    </div>
  </td></tr>

  <tr><td class="sr-pad" style="padding:22px 34px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      ${rowsHtml}
      <tr><td colspan="2" style="padding:0;"><div style="border-top:1px solid ${BORDER};font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr>
        <td style="font-family:${BODY_FONT};font-size:14px;color:${DIM};padding:14px 0 0;">Total</td>
        <td class="sr-total" style="font-family:${DISPLAY_FONT};font-size:24px;font-weight:700;color:${GOLD};text-align:right;white-space:nowrap;padding:14px 0 0;">${escapeHtml(money(input.totalCents))}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td class="sr-pad" style="padding:26px 34px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${INSET};border:1px solid ${BORDER};border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-family:${BODY_FONT};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${DIM};padding-bottom:8px;">Shipping to</div>
        <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:${TEXT};">${ship.map(escapeHtml).join('<br>')}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td class="sr-pad" style="padding:20px 34px 4px;">
    <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:${TEXT};">${escapeHtml(input.shipDateLine)}</div>
    <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${DIM};padding-top:10px;">
      Spotted a problem with the address? Reply now and we'll fix it — nothing has shipped yet,
      and you can cancel for a full refund any time before it does.
    </div>
  </td></tr>

  <tr><td class="sr-pad" style="padding:18px 34px 30px;">
    <div style="font-family:${BODY_FONT};font-size:12px;color:#6f6d84;">Order ${escapeHtml(input.orderRef)}</div>
  </td></tr>`

  const text = [
    `Thanks for pre-ordering ${input.productName}!`,
    '',
    'YOUR ORDER',
    ...rows.map((row) => `  ${row.label}: ${money(row.amount)}`),
    `  Total: ${money(input.totalCents)}`,
    '',
    'SHIPPING TO',
    ...ship.map((line) => `  ${line}`),
    '',
    input.shipDateLine,
    '',
    "Spotted a problem with the address? Reply now and we'll fix it — nothing has",
    'shipped yet, and you can cancel for a full refund any time before it does.',
    '',
    `Order ${input.orderRef}`,
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
  ].join('\n')

  return {
    subject: 'Your Space Race pre-order is confirmed',
    text,
    html: shell({
      title: 'Your Space Race pre-order is confirmed',
      // Shown next to the subject in the inbox — lead with the useful bit.
      preheader: `${money(input.totalCents)} · ${input.shipDateLine}`,
      body,
    }),
  }
}
