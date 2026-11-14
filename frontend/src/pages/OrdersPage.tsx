import OrderList from '../components/OrderList'

export default function OrdersPage({ token, cart }: { token: string; cart: boolean }) {
  return <OrderList token={token} cart={cart} />
}
