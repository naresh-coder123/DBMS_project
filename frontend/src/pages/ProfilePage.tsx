import Feedback from '../components/Feedback'
import { useApi } from '../hooks/useApi'
import type { Customer } from '../types'

export default function ProfilePage({ token, signOut }: { token: string; signOut: () => void }) {
  const user = useApi<Customer>('/user', token)
  return <section className="page"><h1>Your account</h1>{!user.data ? <Feedback {...user} /> : <div className="panel checkout"><h2>{user.data.fname} {user.data.lname}</h2><p>{user.data.cust_mail}</p><p>{user.data.cust_cont}</p></div>}<button className="button signout" onClick={signOut}>Log out</button></section>
}
