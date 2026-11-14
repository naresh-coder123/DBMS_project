export default function Feedback({ error, retry }: { error?: string; retry?: () => void }) {
  return <div className="panel feedback" role={error ? 'alert' : 'status'}>{error || 'Loading…'} {error && retry && <button className="button" onClick={retry}>Retry</button>}</div>
}
