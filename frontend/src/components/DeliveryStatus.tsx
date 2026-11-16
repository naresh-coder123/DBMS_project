import type { OrderDetail } from '../types'

export default function DeliveryStatus({ order, busy, retry }: { order: OrderDetail; busy: boolean; retry: () => void }) {
  const { status, delivery_person: person } = order
  if (status !== 'PAID' && status !== 'OUT_FOR_DELIVERY' && status !== 'DELIVERED') return null

  return <aside className="delivery-panel" aria-label="Delivery tracking">
    <div className="delivery-heading">
      <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="35" r="5" /><circle cx="37" cy="35" r="5" />
        <path d="M11 35h14l7-16h5m-5 0 5 16M13 22h10m-9 0-3 13M5 16h12" />
      </svg>
      <div aria-live="polite">
        <h2>{status === 'DELIVERED' ? 'Order delivered' : status === 'OUT_FOR_DELIVERY' ? 'Out for delivery' : 'Waiting for a delivery person'}</h2>
        {person ? <p>Delivery person <strong>{person.fname} {person.lname}</strong></p> : status === 'PAID' && <p>Payment is saved, but every delivery person is busy, so the assignment was rolled back. A rider is assigned automatically as soon as one is free.</p>}
      </div>
    </div>
    <ol className="delivery-steps">
      <li data-complete="true">Paid</li>
      <li data-complete={status !== 'PAID'}>Out for delivery</li>
      <li data-complete={status === 'DELIVERED'}>Delivered</li>
    </ol>
    {status === 'PAID' && <button className="button" disabled={busy} onClick={retry}>{busy ? 'Checking availability…' : 'Retry assignment'}</button>}
  </aside>
}
