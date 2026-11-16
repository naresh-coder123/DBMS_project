import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { transactionsForOrder } from '../db/transaction';
import * as auth from '../services/auth.service';
import { customerService } from '../services/customer.service';
import { restaurantService } from '../services/restaurant.service';
import { menuItemService } from '../services/menuItem.service';
import * as orders from '../services/order.service';
import { AppError } from '../utils/AppError';
import { email, id, idParamSchema, paginationSchema } from '../validators/common.validator';
import { createCustomerSchema } from '../validators/customer.validator';
import { createOrderSchema, payOrderSchema } from '../validators/order.validator';

const router = Router();
const password = z.string().min(8).max(128);
const signup = createCustomerSchema.extend({ cust_mail: email, password });
const login = z.object({ cust_mail: email, password }).strict();
const cart = createOrderSchema.omit({ cust_id: true });
const payment = payOrderSchema.extend({ o_id: id });

const requireCustomer: RequestHandler = (req, res, next) => {
  const token = /^Bearer (\S+)$/i.exec(req.get('authorization') ?? '')?.[1];
  if (!token) throw new AppError(401, 'Bearer token required');
  res.locals.customerId = auth.tokenCustomer(token);
  next();
};

router.post('/signup', async (req, res) => {
  res.status(201).json(await auth.signup(signup.parse(req.body)));
});

router.post('/login', async (req, res) => {
  const { cust_mail, password } = login.parse(req.body);
  res.json(await auth.login(cust_mail, password));
});

router.get('/user', requireCustomer, async (_req, res) => {
  res.json(await customerService.getById(res.locals.customerId));
});

router.get(['/restaurants', '/restaurents'], async (req, res) => {
  res.json(await restaurantService.list(paginationSchema.parse(req.query)));
});

router.get(['/restaurants/:id/menu', '/restaurents/:id/menu'], async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await restaurantService.getById(id);
  res.json(await menuItemService.list({
    ...paginationSchema.parse(req.query),
    filters: { rest_id: id, is_available: true },
  }));
});

router.get('/ordercart', requireCustomer, async (req, res) => {
  res.json(await orders.listOrders({
    ...paginationSchema.parse(req.query),
    filters: { cust_id: res.locals.customerId, status: 'PLACED' },
  }));
});

router.post('/ordercart', requireCustomer, async (req, res) => {
  res.status(201).json(await orders.createOrder({
    ...cart.parse(req.body),
    cust_id: res.locals.customerId,
  }));
});

router.get('/orderhistory', requireCustomer, async (req, res) => {
  res.json(await orders.listOrders({
    ...paginationSchema.parse(req.query),
    filters: { cust_id: res.locals.customerId },
  }));
});

router.get('/orderhistory/:id', requireCustomer, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orders.getOrder(id, undefined, res.locals.customerId));
});

router.post('/payment', requireCustomer, async (req, res) => {
  const { o_id, amount_paid } = payment.parse(req.body);
  const customerId = res.locals.customerId;
  const paid = await orders.payOrder(o_id, amount_paid, customerId);
  try {
    res.json(await orders.assignDelivery(o_id, customerId));
  } catch (error) {
    // Payment has already committed. Only the assignment rolled back:
    // the order stays PAID and the background job assigns it when a rider is free.
    if (!(error instanceof AppError)) console.error('Delivery assignment failed after payment', error);
    res.json(paid);
  }
});

router.post('/orderhistory/:id/assign-delivery', requireCustomer, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orders.assignDelivery(id, res.locals.customerId));
});

router.post('/orderhistory/:id/cancel', requireCustomer, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orders.cancelOrder(id, res.locals.customerId));
});

// What PostgreSQL did for this order: recorded transactions + the trigger-written status log.
router.get('/orderhistory/:id/db-activity', requireCustomer, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await orders.getOrder(id, undefined, res.locals.customerId); // 404 unless it is this customer's order
  res.json({ transactions: transactionsForOrder(id), history: await orders.getStatusHistory(id) });
});

export default router;
