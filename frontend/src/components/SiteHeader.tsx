export default function SiteHeader({ path, signedIn, quantity }: { path: string; signedIn: boolean; quantity: number }) {
  return (
    <header className="site-header"><div className="shell header-inner">
      <a className="brand" href="#/restaurants"><span aria-hidden="true">✳</span> Table & Takeaway</a>
      <nav aria-label="Main navigation">
        <a className={path.startsWith('/restaurants') ? 'active' : ''} href="#/restaurants">Explore</a>
        <a className={path.startsWith('/orderhistory') ? 'active' : ''} href="#/orderhistory">Orders</a>
        <a className={path === '/user' || path === '/login' || path === '/signup' ? 'active' : ''} href={signedIn ? '#/user' : '#/login'}>{signedIn ? 'Account' : 'Log in'}</a>
      </nav>
      <a className="button cart-link" href="#/ordercart">Cart <span>{quantity}</span></a>
    </div></header>
  )
}
