-- 002: Triggers — business rules enforced inside the database.
-- Errors are raised with RAISE EXCEPTION (SQLSTATE P0001); the API turns them into HTTP 400.


-- ---------------------------------------------------------------------
-- T1. Keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_updated_at        BEFORE UPDATE ON customer        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_restaurant_updated_at      BEFORE UPDATE ON restaurant      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_delivery_person_updated_at BEFORE UPDATE ON delivery_person FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_menu_item_updated_at       BEFORE UPDATE ON menu_item       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_orders_updated_at          BEFORE UPDATE ON orders          FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ---------------------------------------------------------------------
-- T2. Validate order items (BEFORE INSERT/UPDATE/DELETE on order_item)
--     - items can only change while the order is PLACED
--     - menu item must exist, be available, and belong to the order's restaurant
--     - item_price is copied from the menu and can't be edited afterwards
--     - line_no is auto-numbered per order
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_order_item_validate() RETURNS trigger AS $$
DECLARE
    v_status     VARCHAR(20);
    v_rest_id    INT;
    v_menu_rest  INT;
    v_price      NUMERIC(10,2);
    v_available  BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO v_status FROM orders WHERE o_id = OLD.o_id;
        -- Parent already gone => this is an ON DELETE CASCADE, allow it
        IF FOUND AND v_status <> 'PLACED' THEN
            RAISE EXCEPTION 'Items of order % cannot be changed: order is %', OLD.o_id, v_status;
        END IF;
        RETURN OLD;
    END IF;

    SELECT status, rest_id INTO v_status, v_rest_id FROM orders WHERE o_id = NEW.o_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist', NEW.o_id;
    END IF;
    IF v_status <> 'PLACED' THEN
        RAISE EXCEPTION 'Items of order % cannot be changed: order is %', NEW.o_id, v_status;
    END IF;

    IF TG_OP = 'INSERT' OR NEW.menu_item_id IS DISTINCT FROM OLD.menu_item_id THEN
        SELECT rest_id, price, is_available INTO v_menu_rest, v_price, v_available
        FROM menu_item WHERE menu_item_id = NEW.menu_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item % does not exist', NEW.menu_item_id;
        END IF;
        IF v_menu_rest <> v_rest_id THEN
            RAISE EXCEPTION 'Menu item % does not belong to restaurant %', NEW.menu_item_id, v_rest_id;
        END IF;
        IF NOT v_available THEN
            RAISE EXCEPTION 'Menu item % is currently not available', NEW.menu_item_id;
        END IF;

        NEW.item_price := v_price;
    ELSE
        -- Same menu item: the price snapshot is immutable
        NEW.item_price := OLD.item_price;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.line_no IS NULL THEN
        SELECT COALESCE(MAX(line_no), 0) + 1 INTO NEW.line_no
        FROM order_item WHERE o_id = NEW.o_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_item_validate
BEFORE INSERT OR UPDATE OR DELETE ON order_item
FOR EACH ROW EXECUTE FUNCTION fn_order_item_validate();


-- ---------------------------------------------------------------------
-- T3. Recalculate orders.total_amount whenever order items change
--     (derived attribute "Total Amount" from the ER diagram)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_order_recalc_total() RETURNS trigger AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND (TG_OP = 'DELETE' OR OLD.o_id <> NEW.o_id) THEN
        UPDATE orders
        SET total_amount = COALESCE((SELECT SUM(quantity * item_price) FROM order_item WHERE o_id = OLD.o_id), 0)
        WHERE o_id = OLD.o_id;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE orders
        SET total_amount = COALESCE((SELECT SUM(quantity * item_price) FROM order_item WHERE o_id = NEW.o_id), 0)
        WHERE o_id = NEW.o_id;
    END IF;

    RETURN NULL;   -- AFTER trigger: return value is ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_recalc_total
AFTER INSERT OR UPDATE OR DELETE ON order_item
FOR EACH ROW EXECUTE FUNCTION fn_order_recalc_total();


-- ---------------------------------------------------------------------
-- T4. Order status state machine (BEFORE UPDATE OF status)
--     PLACED -> PAID | CANCELLED
--     PAID -> OUT_FOR_DELIVERY | CANCELLED
--     OUT_FOR_DELIVERY -> DELIVERED
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_order_validate_status() RETURNS trigger AS $$
BEGIN
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    IF NOT (
           (OLD.status = 'PLACED'           AND NEW.status IN ('PAID', 'CANCELLED'))
        OR (OLD.status = 'PAID'             AND NEW.status IN ('OUT_FOR_DELIVERY', 'CANCELLED'))
        OR (OLD.status = 'OUT_FOR_DELIVERY' AND NEW.status = 'DELIVERED')
    ) THEN
        RAISE EXCEPTION 'Invalid status change for order %: % -> %', OLD.o_id, OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'PAID' AND NOT EXISTS (
        SELECT 1 FROM payment WHERE o_id = NEW.o_id AND status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Order % cannot be marked PAID without a payment', NEW.o_id;
    END IF;

    IF NEW.status = 'OUT_FOR_DELIVERY' AND NEW.dp_id IS NULL THEN
        RAISE EXCEPTION 'Order % needs a delivery person before going out for delivery', NEW.o_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_validate_status
BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION fn_order_validate_status();


-- ---------------------------------------------------------------------
-- T5. After a status change: write the audit log, and free the
--     delivery person once the order is DELIVERED or CANCELLED
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_order_after_status() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_status_log (o_id, old_status, new_status) VALUES (NEW.o_id, NULL, NEW.status);
        RETURN NULL;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_log (o_id, old_status, new_status) VALUES (NEW.o_id, OLD.status, NEW.status);

        IF NEW.status IN ('DELIVERED', 'CANCELLED') AND NEW.dp_id IS NOT NULL THEN
            UPDATE delivery_person SET is_available = TRUE WHERE dp_id = NEW.dp_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_after_insert
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION fn_order_after_status();

CREATE TRIGGER trg_order_after_status
AFTER UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION fn_order_after_status();


-- ---------------------------------------------------------------------
-- T6. Fill payment fields from the order (BEFORE INSERT on payment)
--     total_amount and cust_id come from the order; change is computed.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_payment_fill() RETURNS trigger AS $$
DECLARE
    v_total  NUMERIC(10,2);
    v_cust   INT;
BEGIN
    SELECT total_amount, cust_id INTO v_total, v_cust FROM orders WHERE o_id = NEW.o_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist', NEW.o_id;
    END IF;
    IF v_total <= 0 THEN
        RAISE EXCEPTION 'Order % has no items to pay for', NEW.o_id;
    END IF;
    IF NEW.amount_paid < v_total THEN
        RAISE EXCEPTION 'Insufficient amount: order total is %, paid %', v_total, NEW.amount_paid;
    END IF;

    NEW.total_amount    := v_total;
    NEW.cust_id         := v_cust;
    NEW.amount_returned := NEW.amount_paid - v_total;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_fill
BEFORE INSERT ON payment
FOR EACH ROW EXECUTE FUNCTION fn_payment_fill();
