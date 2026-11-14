import { useState, type FormEvent } from 'react'
import { api, explain } from '../lib/api'
import Quantity from '../components/Quantity'
import OrderList from '../components/OrderList'
import { money } from '../lib/format'
import type { Basket, Dish, Order, Restaurant } from '../types'

export default function CartPage({ token, basket, changeDish, onPlaced }: { token: string; basket: Basket | null; changeDish: (r: Restaurant, dish: Dish, delta: number) => void; onPlaced: (id: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!basket) return
    const address = String(new FormData(event.currentTarget).get('address')).trim()
    setBusy(true); setError('')
    try {
      const order = await api<Order>('/ordercart', token, { rest_id: basket.restaurant.rest_id, o_addr: address, items: basket.lines.map(line => ({ menu_item_id: line.dish.menu_item_id, quantity: line.quantity })) })
      onPlaced(order.o_id)
    } catch (error) { setError(explain(error)) }
    finally { setBusy(false) }
  }
  return <section className="page"><h1>Your cart</h1>
    {basket && <form className="panel checkout" onSubmit={submit}><h2>{basket.restaurant.rest_name}</h2>
      {basket.lines.map(({ dish, quantity }) => <div className="row" key={dish.menu_item_id}><span>{dish.item_name} · {money(dish.price)}</span><Quantity dish={dish} quantity={quantity} change={delta => { if (!busy) changeDish(basket.restaurant, dish, delta) }} /></div>)}
      <strong>Subtotal {money(basket.lines.reduce((total, line) => total + Number(line.dish.price) * line.quantity, 0))}</strong>
      <label>Delivery address<textarea name="address" required maxLength={500} rows={3} autoComplete="street-address" /></label>
      {error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Checkout'}</button>
    </form>}
    <OrderList token={token} cart embedded />
  </section>
}
