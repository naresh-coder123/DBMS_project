import { RequestHandler } from 'express';
import * as orderService from '../services/order.service';
import { idParamSchema, paginationSchema } from '../validators/common.validator';
import {
  createOrderSchema,
  orderFilterSchema,
  orderItemParamsSchema,
  orderItemSchema,
  payOrderSchema,
  updateOrderItemSchema,
  updateOrderSchema,
} from '../validators/order.validator';

export const listOrders: RequestHandler = async (req, res) => {
  const { limit, offset } = paginationSchema.parse(req.query);
  const filters = orderFilterSchema.parse(req.query);
  res.json(await orderService.listOrders({ limit, offset, filters }));
};

export const getOrder: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orderService.getOrder(id));
};

export const getOrderHistory: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orderService.getStatusHistory(id));
};

export const createOrder: RequestHandler = async (req, res) => {
  const body = createOrderSchema.parse(req.body);
  res.status(201).json(await orderService.createOrder(body));
};

export const updateOrder: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { o_addr } = updateOrderSchema.parse(req.body);
  res.json(await orderService.updateOrderAddress(id, o_addr));
};

export const addItem: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { menu_item_id, quantity } = orderItemSchema.parse(req.body);
  res.status(201).json(await orderService.addOrderItem(id, menu_item_id, quantity));
};

export const updateItem: RequestHandler = async (req, res) => {
  const { id, lineNo } = orderItemParamsSchema.parse(req.params);
  const { quantity } = updateOrderItemSchema.parse(req.body);
  res.json(await orderService.updateOrderItem(id, lineNo, quantity));
};

export const removeItem: RequestHandler = async (req, res) => {
  const { id, lineNo } = orderItemParamsSchema.parse(req.params);
  res.json(await orderService.removeOrderItem(id, lineNo));
};

export const payOrder: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { amount_paid } = payOrderSchema.parse(req.body);
  res.json(await orderService.payOrder(id, amount_paid));
};

export const assignDelivery: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orderService.assignDelivery(id));
};

export const deliverOrder: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orderService.markDelivered(id));
};

export const cancelOrder: RequestHandler = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await orderService.cancelOrder(id));
};
