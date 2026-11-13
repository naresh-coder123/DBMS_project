import { DeliveryPerson } from '../types/models';
import { createCrudService } from './crud.service';

export const deliveryPersonService = createCrudService<DeliveryPerson>({
  table: 'delivery_person',
  idColumn: 'dp_id',
  entityName: 'Delivery person',
  columns: ['fname', 'lname', 'dp_cont', 'dp_mail', 'is_available'],
  filterable: ['is_available'],
});
