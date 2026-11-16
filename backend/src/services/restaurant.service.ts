import { Restaurant } from '../types/models';
import { createCrudService } from './crud.service';

export const restaurantService = createCrudService<Restaurant>({
  table: 'restaurant',
  idColumn: 'rest_id',
  entityName: 'Restaurant',
});
