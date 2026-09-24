// Chrome shared by the checkout and confirmation views. The storefront
// itself is ScrollStore.

export function Brand() {
  return (
    <a className="store-brand" href="/shop.html" aria-label="Space Race store">
      <span>SPACE RACE</span>
      <small>1,000 light-years</small>
    </a>
  )
}

export function StoreFooter() {
  return (
    <footer className="store-footer">
      <Brand />
      <div>
        <a href="/get">Ways to play</a>
        <a href="/privacy.html">Privacy</a>
      </div>
    </footer>
  )
}
