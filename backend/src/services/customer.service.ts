import { Customer } from '../types/models';
import { createCrudService } from './crud.service';

export const customerService = createCrudService<Customer>({
  table: 'customer',
  idColumn: 'cust_id',
  entityName: 'Customer',
  columns: ['fname', 'lname', 'cust_cont', 'cust_mail'],
});
