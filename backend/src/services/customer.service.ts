import { pool } from '../db/pool';
import { Customer } from '../types/models';
import { AppError } from '../utils/AppError';

export const customerProfileColumns = 'cust_id, fname, lname, cust_cont, cust_mail, created_at, updated_at';

export const customerService = {
  async getById(id: number): Promise<Customer> {
    const { rows: [customer] } = await pool.query<Customer>(
      `SELECT ${customerProfileColumns} FROM customer WHERE cust_id = $1`,
      [id],
    );
    if (!customer) throw AppError.notFound('Customer', id);
    return customer;
  },
};
