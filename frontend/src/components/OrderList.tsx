import Feedback from './Feedback'
import { useApi } from '../hooks/useApi'
import { money, titleStatus } from '../lib/format'
import type { Order } from '../types'

export default function OrderList({ token, cart, embedded = false }: { token: string; cart: boolean; embedded?: boolean }) {
  const orders = useApi<Order[]>((cart ? '/ordercart' : '/orderhistory') + '?limit=100', token)
  return <section className={embedded ? 'section' : 'page'}>{embedded ? <h2>Unpaid orders</h2> : <h1>{cart ? 'Unpaid orders' : 'Order history'}</h1>}
    {!orders.data ? <Feedback {...orders} /> : !orders.data.length ? <div className="panel feedback">{cart ? 'No unpaid orders.' : 'No orders yet.'} <a href="#/restaurants">Explore restaurants</a></div> :
      <div className="order-list">{orders.data.map(order => <a className="panel row order-card" href={`#/${cart ? 'payment' : 'orderhistory'}/${order.o_id}`} key={order.o_id}><div><strong>Order #{order.o_id}</strong><p>{new Date(order.o_date).toLocaleDateString('en-IN')} · {order.o_addr}</p></div><div><strong>{money(order.total_amount)}</strong><p className={order.status === 'PAID' || order.status === 'DELIVERED' ? 'success status' : 'status'}>{titleStatus(order.status)}</p></div></a>)}</div>}
  </section>
}
