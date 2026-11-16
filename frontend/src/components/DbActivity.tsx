import { useApi } from '../hooks/useApi'
import { titleStatus } from '../lib/format'
import type { DbActivity as Activity, TxStep } from '../types'

const labels: Record<TxStep['kind'], string> = { tx: 'TX', sql: 'SQL', trigger: 'TRIGGER', error: 'ERROR' }
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Shows what PostgreSQL did for one order: each transaction, the triggers it fired, and the status log. */
export default function DbActivity({ id, token, refreshKey }: { id: number; token: string; refreshKey: string }) {
  const { data, error } = useApi<Activity>(`/orderhistory/${id}/db-activity?v=${encodeURIComponent(refreshKey)}`, token)
  if (error) return <p className="db-activity" role="alert">{error}</p>
  if (!data) return null
  const transactions = [...data.transactions].reverse()

  return <section className="db-activity" aria-label="Database activity">
    <div>
      <p className="eyebrow">DBMS view</p>
      <h2>Database activity</h2>
      <p>Each action on this order runs as one PostgreSQL transaction. Trigger lines are notices sent back by the triggers as they fire.</p>
    </div>

    <h3>Transactions <small>newest first</small></h3>
    {transactions.length === 0
      ? <p>No transactions recorded for this order since the API last started.</p>
      : transactions.map((tx, index) => <details key={tx.id} className="tx" open={index === 0}>
        <summary>
          <span className={`tx-outcome ${tx.outcome.toLowerCase()}`}>{tx.outcome}</span>
          <strong>{tx.name}</strong>
          <span className="tx-meta">{time(tx.startedAt)} · {tx.ms} ms · {tx.steps.filter(step => step.kind === 'trigger').length} trigger events</span>
        </summary>
        <ol className="tx-steps">
          {tx.steps.map((step, i) => <li key={i} data-kind={step.kind} data-read={step.kind === 'sql' && /^SELECT/i.test(step.text) && !/FOR UPDATE/i.test(step.text)}>
            <span>{labels[step.kind]}</span><code>{step.text}</code>
          </li>)}
        </ol>
      </details>)}

    <h3>order_status_log <small>rows written by trigger T5</small></h3>
    <div className="table-wrap">
      <table>
        <thead><tr><th>log_id</th><th>old_status</th><th>new_status</th><th>changed_at</th></tr></thead>
        <tbody>{data.history.map(row => <tr key={row.log_id}>
          <td>{row.log_id}</td><td>{row.old_status ? titleStatus(row.old_status) : '—'}</td><td>{titleStatus(row.new_status)}</td><td>{time(row.changed_at)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>
}
