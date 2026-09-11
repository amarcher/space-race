// Local review server. Uses existing installed dependencies and Stripe TEST only.
// No payment confirmation, order creation, or fulfillment is performed here.
import {
  createServer,
  loadEnv,
} from '../../web/node_modules/vite/dist/node/index.js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../web', import.meta.url))
const env = loadEnv(
  'development',
  process.env.SPACE_RACE_ENV_DIR ?? root,
  'VITE_'
)
const key = env.VITE_STRIPE_PUBLISHABLE_KEY
if (!key?.startsWith('pk_test_'))
  throw new Error('Preview requires the existing Stripe TEST publishable key')
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  define: {
    'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(key),
  },
  server: { host: '127.0.0.1', port: 5192, strictPort: true, open: false },
  plugins: [
    {
      name: 'storefront-review-api',
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url === '/shop') req.url = '/shop.html'
          if (req.url === '/get') req.url = '/get.html'
          if (
            ![
              '/api/inventory-status',
              '/api/create-checkout-session',
              '/api/shipping-rates',
            ].includes(req.url)
          )
            return next()
          try {
            const state = await readFile(
              new URL('./preview-state.local', import.meta.url),
              'utf8'
            )
              .then(JSON.parse)
              .catch(() => ({}))
            if (req.url === '/api/inventory-status' && state.inventory) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(state.inventory))
              return
            }
            if (
              (req.url === '/api/create-checkout-session' &&
                state.failCheckout) ||
              (req.url === '/api/inventory-status' && state.failInventory)
            ) {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error:
                    'Checkout could not start right now. Please try again.',
                })
              )
              return
            }
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const body = Buffer.concat(chunks)
            const upstream = await fetch(
              `https://game.spaceexplorer.tech${req.url}`,
              {
                method: req.method,
                headers: {
                  'Content-Type': 'application/json',
                  Origin: 'http://localhost:5192',
                },
                body: body.length ? body : undefined,
                signal: AbortSignal.timeout(20000),
              }
            )
            const data = await upstream.json()
            if (
              req.url === '/api/create-checkout-session' &&
              data.clientSecret &&
              !data.clientSecret.startsWith('cs_test_')
            )
              throw new Error('Non-test checkout refused')
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
          } catch {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Preview API unavailable. Please try again.',
              })
            )
          }
        })
      },
    },
  ],
})
await server.listen()
console.log(
  'Storefront preview: http://localhost:5192/shop.html (Stripe TEST only)'
)
