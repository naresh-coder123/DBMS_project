import { RequestHandler } from 'express';
import { ZodType } from 'zod';
import { CrudService } from '../services/crud.service';
import { idParamSchema, paginationSchema } from '../validators/common.validator';

type Schema = ZodType<Record<string, unknown>>;

/** Omit `create`/`update` for a read-only resource. */
export interface CrudSchemas {
  create?: Schema;
  update?: Schema;
  filters?: Schema;
}

export interface CrudController {
  list: RequestHandler;
  getById: RequestHandler;
  create?: RequestHandler;
  update?: RequestHandler;
  remove?: RequestHandler;
}

/**
 * Standard handlers: validate input with zod, call the service, send JSON.
 * Express 5 forwards rejected promises to the error handler automatically.
 */
export function createCrudController<T>(service: CrudService<T>, schemas: CrudSchemas): CrudController {
  const controller: CrudController = {
    list: async (req, res) => {
      const { limit, offset } = paginationSchema.parse(req.query);
      const filters = schemas.filters?.parse(req.query) ?? {};
      res.json(await service.list({ limit, offset, filters }));
    },

    getById: async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.getById(id));
    },
  };

  const { create, update } = schemas;
  if (!create || !update) return controller;

  return {
    ...controller,

    create: async (req, res) => {
      res.status(201).json(await service.create(create.parse(req.body)));
    },

    update: async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.update(id, update.parse(req.body)));
    },

    remove: async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      await service.remove(id);
      res.status(204).end();
    },
  };
}
