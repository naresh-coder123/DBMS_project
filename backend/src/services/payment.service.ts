import { Payment } from '../types/models';
import { createCrudService } from './crud.service';

// Read-only over the API: payments are created/refunded only by order transactions (pay / cancel).
export const paymentService = createCrudService<Payment>({
  table: 'payment',
  idColumn: 'pay_id',
  entityName: 'Payment',
  columns: [],
  filterable: ['cust_id', 'o_id', 'status'],
});
