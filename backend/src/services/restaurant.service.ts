import { Restaurant } from '../types/models';
import { createCrudService } from './crud.service';

export const restaurantService = createCrudService<Restaurant>({
  table: 'restaurant',
  idColumn: 'rest_id',
  entityName: 'Restaurant',
  columns: ['rest_name', 'rest_cont', 'rest_address'],
});
