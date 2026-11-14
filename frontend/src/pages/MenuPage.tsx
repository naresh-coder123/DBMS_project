import { useState } from 'react'
import Feedback from '../components/Feedback'
import { useApi } from '../hooks/useApi'
import Quantity from '../components/Quantity'
import { imageFor, photo } from '../lib/foodImages'
import { money } from '../lib/format'
import type { Basket, Dish, Restaurant } from '../types'

export default function MenuPage({ id, basket, changeDish }: { id: number; basket: Basket | null; changeDish: (r: Restaurant, dish: Dish, delta: number) => void }) {
  const restaurants = useApi<Restaurant[]>('/restaurants?limit=100')
  const menu = useApi<Dish[]>(`/restaurants/${id}/menu?limit=100`)
  const [category, setCategory] = useState('')
  const restaurant = restaurants.data?.find(r => r.rest_id === id)
  const categories = [...new Set(menu.data?.map(dish => dish.item_category).filter(Boolean))]
  const dishes = menu.data?.filter(dish => !category || dish.item_category === category)
  return <>
    <a className="back" href="#/restaurants">← All restaurants</a>
    {!restaurant ? restaurants.data ? <Feedback error="Restaurant not found." /> : <Feedback {...restaurants} /> : <>
      <section className="menu-hero"><div><p className="eyebrow">RESTAURANT MENU</p><h1>{restaurant.rest_name}</h1><p>{restaurant.rest_address}</p></div><img src={photo(imageFor(restaurant.rest_name), 800)} alt="" /></section>
      <section className="section"><div className="section-head"><h2>On the menu</h2></div>
        {!!categories.length && <div className="chips">{['', ...categories].map(value => <button key={value} className="chip" aria-pressed={category === value} onClick={() => setCategory(value || '')}>{value || 'All items'}</button>)}</div>}
        {!dishes ? <Feedback {...menu} /> : !dishes.length ? <div className="panel feedback">No dishes are available.</div> :
          <div className="dish-grid">{dishes.map(dish => <div className="panel dish" key={dish.menu_item_id}><div><p>{dish.item_category}</p><h3>{dish.item_name}</h3><strong>{money(dish.price)}</strong></div><Quantity dish={dish} quantity={basket?.lines.find(line => line.dish.menu_item_id === dish.menu_item_id)?.quantity ?? 0} change={delta => changeDish(restaurant, dish, delta)} /></div>)}</div>}
      </section>
    </>}
  </>
}
