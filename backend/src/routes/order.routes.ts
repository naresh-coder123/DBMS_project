import { Router } from 'express';
import * as c from '../controllers/order.controller';

const router = Router();

router.get('/', c.listOrders);
router.post('/', c.createOrder);
router.get('/:id', c.getOrder);
router.patch('/:id', c.updateOrder);
router.get('/:id/history', c.getOrderHistory);

router.post('/:id/items', c.addItem);
router.patch('/:id/items/:lineNo', c.updateItem);
router.delete('/:id/items/:lineNo', c.removeItem);

router.post('/:id/pay', c.payOrder);
router.post('/:id/assign', c.assignDelivery);
router.post('/:id/deliver', c.deliverOrder);
router.post('/:id/cancel', c.cancelOrder);

export default router;
