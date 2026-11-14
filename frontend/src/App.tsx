import { useEffect, useState } from 'react'
import SiteHeader from './components/SiteHeader'
import AuthPage from './pages/AuthPage'
import CartPage from './pages/CartPage'
import MenuPage from './pages/MenuPage'
import OrderPage from './pages/OrderPage'
import OrdersPage from './pages/OrdersPage'
import ProfilePage from './pages/ProfilePage'
import RestaurantsPage from './pages/RestaurantsPage'
import type { Basket, Dish, Restaurant } from './types'
import './App.css'

const tokenKey = 'table-takeaway-token'
const go = (path: string) => { window.location.hash = path }
const currentPath = () => window.location.hash.slice(1) || '/restaurants'

function App() {
  const [path, setPath] = useState(currentPath)
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '')
  const [basket, setBasket] = useState<Basket | null>(null)
  const [search, setSearch] = useState('')
  const [returnTo, setReturnTo] = useState('/restaurants')
  const quantity = basket?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0
  const needsLogin = ['/user', '/ordercart', '/orderhistory', '/payment'].some(route => path === route || path.startsWith(route + '/'))

  useEffect(() => {
    const navigate = () => { setPath(currentPath()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  function signOut() {
    localStorage.removeItem(tokenKey)
    setToken('')
    setBasket(null)
    setReturnTo('/restaurants')
    go('/login')
  }

  function changeDish(restaurant: Restaurant, dish: Dish, delta: number) {
    if (basket && basket.restaurant.rest_id !== restaurant.rest_id && !window.confirm('Replace your basket with items from this restaurant?')) return
    setBasket(previous => {
      const lines = previous?.restaurant.rest_id === restaurant.rest_id ? previous.lines : []
      const quantity = (lines.find(line => line.dish.menu_item_id === dish.menu_item_id)?.quantity ?? 0) + delta
      if (quantity > 50 || (quantity > 0 && lines.length >= 30 && !lines.some(line => line.dish.menu_item_id === dish.menu_item_id))) return previous
      const next = lines.filter(line => line.dish.menu_item_id !== dish.menu_item_id)
      if (quantity > 0) next.push({ dish, quantity })
      next.sort((a, b) => a.dish.menu_item_id - b.dish.menu_item_id)
      return next.length ? { restaurant, lines: next } : null
    })
  }

  const menuMatch = /^\/restaurants\/(\d+)$/.exec(path)
  const orderMatch = /^\/(orderhistory|payment)\/(\d+)$/.exec(path)
  let content
  if (path === '/login' || path === '/signup' || (needsLogin && !token)) {
    content = <AuthPage signup={path === '/signup'} onSwitch={() => { if (needsLogin) setReturnTo(path) }} onLogin={value => {
      localStorage.setItem(tokenKey, value)
      setToken(value)
      go(needsLogin ? path : returnTo)
    }} />
  } else if (menuMatch) {
    content = <MenuPage id={Number(menuMatch[1])} basket={basket} changeDish={changeDish} />
  } else if (path === '/ordercart') {
    content = <CartPage token={token} basket={basket} changeDish={changeDish} onPlaced={id => { setBasket(null); go('/payment/' + id) }} />
  } else if (orderMatch) {
    content = <OrderPage id={Number(orderMatch[2])} token={token} checkout={orderMatch[1] === 'payment'} />
  } else if (path === '/orderhistory' || path === '/payment') {
    content = <OrdersPage token={token} cart={path === '/payment'} />
  } else if (path === '/user') {
    content = <ProfilePage token={token} signOut={signOut} />
  } else {
    content = <RestaurantsPage search={search} setSearch={setSearch} />
  }

  return <>
    <SiteHeader path={path} signedIn={Boolean(token)} quantity={quantity} />
    <main className="shell" key={path}>{content}</main>
    <footer className="shell footer"><a className="brand" href="#/restaurants">✳ Table & Takeaway</a><span>Food delivery · DBMS project</span></footer>
  </>
}

export default App
