import { MenuItem } from '../types/models';
import { createCrudService } from './crud.service';

export const menuItemService = createCrudService<MenuItem>({
  table: 'menu_item',
  idColumn: 'menu_item_id',
  entityName: 'Menu item',
  filterable: ['rest_id', 'item_category', 'is_available'],
});
