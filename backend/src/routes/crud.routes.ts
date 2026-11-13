import { Router } from 'express';
import { createCrudController, CrudSchemas } from '../controllers/crud.controller';
import { CrudService } from '../services/crud.service';

/**
 * GET / · GET /:id — always
 * POST / · PATCH /:id · DELETE /:id — only when create/update schemas are given
 */
export function crudRouter<T>(service: CrudService<T>, schemas: CrudSchemas = {}): Router {
  const c = createCrudController(service, schemas);
  const router = Router();

  router.get('/', c.list);
  router.get('/:id', c.getById);
  if (c.create) router.post('/', c.create);
  if (c.update) router.patch('/:id', c.update);
  if (c.remove) router.delete('/:id', c.remove);

  return router;
}
