export type Restaurant = { rest_id: number; rest_name: string; rest_address: string; rest_cont: string }
export type Dish = { menu_item_id: number; item_name: string; item_category: string | null; price: string }
export type Order = { o_id: number; rest_id: number; o_addr: string; o_date: string; total_amount: string; status: string }
export type OrderDetail = Order & { items: { line_no: number; item_name: string; quantity: number; line_total: string }[]; payment: { pay_id: number; amount_paid: string; status: string } | null }
export type Customer = { fname: string; lname: string | null; cust_mail: string; cust_cont: string }
export type Basket = { restaurant: Restaurant; lines: { dish: Dish; quantity: number }[] }
