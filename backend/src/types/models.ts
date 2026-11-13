// Row shapes as returned by `pg`. NUMERIC columns come back as strings.

export type OrderStatus = 'PLACED' | 'PAID' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface Customer {
  cust_id: number;
  fname: string;
  lname: string | null;
  cust_cont: string;
  cust_mail: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Restaurant {
  rest_id: number;
  rest_name: string;
  rest_cont: string;
  rest_address: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryPerson {
  dp_id: number;
  fname: string;
  lname: string | null;
  dp_cont: string;
  dp_mail: string | null;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MenuItem {
  menu_item_id: number;
  rest_id: number;
  item_name: string;
  item_category: string | null;
  price: string;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  o_id: number;
  cust_id: number;
  rest_id: number;
  dp_id: number | null;
  o_addr: string;
  o_date: Date;
  total_amount: string;
  status: OrderStatus;
  updated_at: Date;
}

export interface OrderItem {
  o_id: number;
  line_no: number;
  menu_item_id: number;
  quantity: number;
  item_price: string;
}

export interface Payment {
  pay_id: number;
  o_id: number;
  cust_id: number;
  total_amount: string;
  amount_paid: string;
  amount_returned: string;
  status: 'PAID' | 'REFUNDED';
  pay_date: Date;
}

export interface OrderStatusLog {
  log_id: number;
  o_id: number;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_at: Date;
}
