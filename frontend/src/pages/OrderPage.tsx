import { useState } from 'react'
import Feedback from '../components/Feedback'
import { useApi } from '../hooks/useApi'
import { api, explain } from '../lib/api'
import { money, titleStatus } from '../lib/format'
import type { OrderDetail } from '../types'

export default function OrderPage({ id, token, checkout }: { id: number; token: string; checkout: boolean }) {
  const order = useApi<OrderDetail>('/orderhistory/' + id, token)
  const [paid, setPaid] = useState<OrderDetail>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const detail = paid || order.data
  async function pay() {
    if (!detail) return
    setBusy(true); setError('')
    try { setPaid(await api<OrderDetail>('/payment', token, { o_id: id, amount_paid: Number(detail.total_amount) })) }
    catch (error) { setError(explain(error)) }
    finally { setBusy(false) }
  }
  return <section className="page"><a className="back" href={checkout ? '#/ordercart' : '#/orderhistory'}>← {checkout ? 'Back to cart' : 'Order history'}</a>
    <h1>{checkout ? 'Checkout' : `Order #${id}`}</h1>
    {!detail ? <Feedback {...order} /> : <div className="panel checkout">
      <div className="row"><strong>Order #{id}</strong><span className={detail.status === 'PAID' || detail.status === 'DELIVERED' ? 'success status' : 'status'}>{titleStatus(detail.status)}</span></div>
      <p>{detail.o_addr}</p>
      {detail.items.map(item => <div className="row" key={item.line_no}><span>{item.quantity} × {item.item_name}</span><strong>{money(item.line_total)}</strong></div>)}
      <div className="row"><strong>Order total</strong><strong>{money(detail.total_amount)}</strong></div>
      {detail.payment && <p role="status">Payment #{detail.payment.pay_id} · {titleStatus(detail.payment.status)} · {money(detail.payment.amount_paid)}</p>}
      {error && <p role="alert">{error}</p>}
      {detail.status === 'PLACED' && (checkout ? <><p>Demo payment · no money will be charged.</p><button className="button primary" disabled={busy} onClick={pay}>{busy ? 'Recording payment…' : `Pay ${money(detail.total_amount)}`}</button></> : <a className="button primary" href={`#/payment/${id}`}>Checkout</a>)}
    </div>}
  </section>
}
