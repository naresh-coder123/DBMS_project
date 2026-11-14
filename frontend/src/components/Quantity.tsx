import type { Dish } from '../types'

export default function Quantity({ dish, quantity, change }: { dish: Dish; quantity: number; change: (delta: number) => void }) {
  return quantity ? <div className="stepper"><button type="button" aria-label={`Remove one ${dish.item_name}`} onClick={() => change(-1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Add one ${dish.item_name}`} disabled={quantity >= 50} onClick={() => change(1)}>+</button></div>
    : <button type="button" className="button primary" onClick={() => change(1)}>Add to cart</button>
}
