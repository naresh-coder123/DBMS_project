import { useEffect, useState } from 'react'
import Feedback from '../components/Feedback'
import DbActivity from '../components/DbActivity'
import DeliveryStatus from '../components/DeliveryStatus'
import { useApi } from '../hooks/useApi'
import { api, explain } from '../lib/api'
import { money, titleStatus } from '../lib/format'
import type { OrderDetail } from '../types'

export default function OrderPage({ id, token, checkout }: { id: number; token: string; checkout: boolean }) {
  const order = useApi<OrderDetail>('/orderhistory/' + id, token)
  const [paid, setPaid] = useState<OrderDetail>()
  const [busy, setBusy] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  // Bumped after every action (success or failure) so the database panel reloads, rollbacks included.
  const [actions, setActions] = useState(0)
  const detail = paid || order.data
  const status = detail?.status
  const [toast, setToast] = useState('')
  const [shownStatus, setShownStatus] = useState(status)

  // Pop-up when the status changes while this page is open (not on the first load).
  if (status !== shownStatus) {
    setShownStatus(status)
    const person = detail?.delivery_person
    if (shownStatus) setToast(
      status === 'PAID' ? '⏳ Payment saved. All delivery persons are busy, so your order is waiting for one.'
      : status === 'OUT_FOR_DELIVERY' ? `🛵 ${person ? `${person.fname} ${person.lname ?? ''}`.trim() : 'A delivery person'} is on the way with your order.`
      : status === 'DELIVERED' ? '✅ Your order has been delivered. Enjoy your meal!'
      : status === 'CANCELLED' ? `Order cancelled${detail?.payment?.status === 'REFUNDED' ? ' and payment refunded' : ''}.`
      : '',
    )
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    // Keep refreshing while waiting for a rider (PAID) or while out for delivery.
    if (status !== 'PAID' && status !== 'OUT_FOR_DELIVERY') return
    const controller = new AbortController()
    let timer: number

    async function refresh() {
      try {
        const latest = await api<OrderDetail>(`/orderhistory/${id}`, token, undefined, controller.signal)
        if (!controller.signal.aborted) setPaid(latest)
        if (latest.status !== status) return
      } catch {
        // Retry temporary network failures while tracking the order.
      }
      if (!controller.signal.aborted) timer = window.setTimeout(refresh, 1000)
    }

    timer = window.setTimeout(refresh, 1000)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [id, status, token])

  async function run(action: () => Promise<OrderDetail>, confirmation = false) {
    setBusy(true); setError('')
    try {
      setPaid(await action())
      setShowConfirmation(confirmation)
    }
    catch (error) { setError(explain(error)) }
    finally { setBusy(false); setActions(value => value + 1) }
  }
  const pay = () => detail && run(() => api<OrderDetail>('/payment', token, { o_id: id, amount_paid: Number(amount || detail.total_amount) }), true)
  const retryAssignment = () => run(() => api<OrderDetail>(`/orderhistory/${id}/assign-delivery`, token, {}))
  const cancel = () => window.confirm(`Cancel order #${id}?`) && run(() => api<OrderDetail>(`/orderhistory/${id}/cancel`, token, {}))

  return <section className="page"><a className="back" href={checkout ? '#/ordercart' : '#/orderhistory'}>← {checkout ? 'Back to cart' : 'Order history'}</a>
    <h1>{checkout ? 'Checkout' : `Order #${id}`}</h1>
    {!detail ? <Feedback {...order} /> : <>
      <div className="panel checkout">
        {showConfirmation && detail.payment?.status === 'PAID' && <div className="payment-confirmation" role="status">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="30" />
            <path d="m19 33 9 9 17-19" pathLength="1" />
          </svg>
          <div><h2>Payment successful</h2><p>{money(detail.payment.amount_paid)} paid</p></div>
        </div>}
        <div className="row"><strong>Order #{id}</strong><span className={detail.status === 'PAID' || detail.status === 'DELIVERED' ? 'success status' : 'status'}>{titleStatus(detail.status)}</span></div>
        <p>{detail.o_addr}</p>
        {detail.items.map(item => <div className="row" key={item.line_no}><span>{item.quantity} × {item.item_name}</span><strong>{money(item.line_total)}</strong></div>)}
        <div className="row"><strong>Order total</strong><strong>{money(detail.total_amount)}</strong></div>
        {detail.payment && <p role="status">Payment #{detail.payment.pay_id} · {titleStatus(detail.payment.status)} · {money(detail.payment.amount_paid)} paid · {money(detail.payment.amount_returned)} change</p>}
        {error && <p role="alert">{error}</p>}
        <DeliveryStatus order={detail} busy={busy} retry={retryAssignment} />
        {detail.status === 'PLACED' && (checkout ? <>
          <label className="amount-field">Amount paid (₹)
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} placeholder={detail.total_amount} onChange={event => setAmount(event.target.value)} />
          </label>
          <p>Demo payment · no money will be charged. Enter less than the total to watch trigger T6 reject it and the transaction roll back.</p>
          <button className="button primary" disabled={busy} onClick={pay}>{busy ? 'Recording payment…' : `Pay ${money(amount || detail.total_amount)}`}</button>
        </> : <a className="button primary" href={`#/payment/${id}`}>Checkout</a>)}
        {(detail.status === 'PLACED' || detail.status === 'PAID') && <button className="button" disabled={busy} onClick={cancel}>Cancel order{detail.payment?.status === 'PAID' ? ' and refund' : ''}</button>}
      </div>
      <DbActivity id={id} token={token} refreshKey={`${detail.status}-${detail.payment?.status ?? ''}-${actions}`} />
    </>}
    {toast && <div className="toast" role="status" aria-live="polite">
      <span>{toast}</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}>×</button>
    </div>}
  </section>
}
