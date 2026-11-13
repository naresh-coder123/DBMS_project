import { Router } from 'express';
import { customerService } from '../services/customer.service';
import { deliveryPersonService } from '../services/deliveryPerson.service';
import { menuItemService } from '../services/menuItem.service';
import { paymentService } from '../services/payment.service';
import { restaurantService } from '../services/restaurant.service';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.validator';
import {
  createDeliveryPersonSchema,
  deliveryPersonFilterSchema,
  updateDeliveryPersonSchema,
} from '../validators/deliveryPerson.validator';
import { createMenuItemSchema, menuItemFilterSchema, updateMenuItemSchema } from '../validators/menuItem.validator';
import { paymentFilterSchema } from '../validators/payment.validator';
import { createRestaurantSchema, updateRestaurantSchema } from '../validators/restaurant.validator';
import { crudRouter } from './crud.routes';
import orderRoutes from './order.routes';

const router = Router();

router.use('/customers', crudRouter(customerService, {
  create: createCustomerSchema,
  update: updateCustomerSchema,
}));

router.use('/restaurants', crudRouter(restaurantService, {
  create: createRestaurantSchema,
  update: updateRestaurantSchema,
}));

router.use('/delivery-persons', crudRouter(deliveryPersonService, {
  create: createDeliveryPersonSchema,
  update: updateDeliveryPersonSchema,
  filters: deliveryPersonFilterSchema,
}));

router.use('/menu-items', crudRouter(menuItemService, {
  create: createMenuItemSchema,
  update: updateMenuItemSchema,
  filters: menuItemFilterSchema,
}));

// Read-only: created/refunded via /orders/:id/pay and /orders/:id/cancel
router.use('/payments', crudRouter(paymentService, { filters: paymentFilterSchema }));

router.use('/orders', orderRoutes);

export default router;
