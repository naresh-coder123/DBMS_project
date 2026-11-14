import Feedback from '../components/Feedback'
import { useApi } from '../hooks/useApi'
import { food, imageFor, photo } from '../lib/foodImages'
import type { Restaurant } from '../types'

export default function RestaurantsPage({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  const restaurants = useApi<Restaurant[]>('/restaurants?limit=100')
  const filtered = restaurants.data?.filter(r => (r.rest_name + ' ' + r.rest_address).toLowerCase().includes(search.trim().toLowerCase()))
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">LOCAL FOOD DELIVERY</p><h1>Good food.<br />Right to your door.</h1><p>Browse local restaurants, pick your favourites, and order from their menus.</p>
        <label className="search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search restaurants" placeholder="Search by restaurant or area" value={search} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      <img className="hero-photo" src={photo(food.hero, 1050)} alt="A table of colourful dishes ready to share" fetchPriority="high" />
    </section>
    <section className="section"><div className="section-head"><h2>Explore restaurants</h2>{filtered && <span>{filtered.length} {filtered.length === 1 ? 'restaurant' : 'restaurants'}</span>}</div>
      {!filtered ? <Feedback {...restaurants} /> : filtered.length === 0 ? <div className="panel feedback">{search.trim() ? 'No restaurants match your search.' : 'No restaurants are available yet.'}</div> :
        <div className="restaurant-grid">{filtered.map(r => <a className="restaurant-card" href={`#/restaurants/${r.rest_id}`} key={r.rest_id}>
          <img src={photo(imageFor(r.rest_name), 640)} alt="" loading="lazy" /><div className="card-copy"><h3>{r.rest_name}</h3><p>{r.rest_address}</p><span className="card-action">View menu <span aria-hidden="true">↗</span></span></div>
        </a>)}</div>}
    </section>
  </>
}
