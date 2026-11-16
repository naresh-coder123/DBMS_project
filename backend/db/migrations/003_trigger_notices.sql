-- 003: Same trigger rules as 002, plus RAISE NOTICE lines so every trigger
-- reports when it fires. The API captures these notices per transaction and
-- the order page shows them, which makes trigger activity visible in the demo.
-- (002 is already applied, so the functions are replaced here, not edited there.)


-- T1. Keep updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RAISE NOTICE 'T1 fn_set_updated_at: updated_at stamped on % row', TG_TABLE_NAME;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- T2. Validate order items, copy the menu price, auto-number line_no
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
        RAISE NOTICE 'T2 fn_order_item_validate: removing line % allowed', OLD.line_no;
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

    RAISE NOTICE 'T2 fn_order_item_validate: menu item % checked (right restaurant, available), line % priced at %',
        NEW.menu_item_id, NEW.line_no, NEW.item_price;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- T3. Recalculate orders.total_amount whenever order items change
CREATE OR REPLACE FUNCTION fn_order_recalc_total() RETURNS trigger AS $$
DECLARE
    v_total NUMERIC(10,2);
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND (TG_OP = 'DELETE' OR OLD.o_id <> NEW.o_id) THEN
        UPDATE orders
        SET total_amount = COALESCE((SELECT SUM(quantity * item_price) FROM order_item WHERE o_id = OLD.o_id), 0)
        WHERE o_id = OLD.o_id
        RETURNING total_amount INTO v_total;
        RAISE NOTICE 'T3 fn_order_recalc_total: order % total recalculated to %', OLD.o_id, v_total;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE orders
        SET total_amount = COALESCE((SELECT SUM(quantity * item_price) FROM order_item WHERE o_id = NEW.o_id), 0)
        WHERE o_id = NEW.o_id
        RETURNING total_amount INTO v_total;
        RAISE NOTICE 'T3 fn_order_recalc_total: order % total recalculated to %', NEW.o_id, v_total;
    END IF;

    RETURN NULL;   -- AFTER trigger: return value is ignored
END;
$$ LANGUAGE plpgsql;


-- T4. Order status state machine
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

    RAISE NOTICE 'T4 fn_order_validate_status: % -> % is a valid transition', OLD.status, NEW.status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- T5. Write the audit log; free the delivery person once DELIVERED or CANCELLED
CREATE OR REPLACE FUNCTION fn_order_after_status() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_status_log (o_id, old_status, new_status) VALUES (NEW.o_id, NULL, NEW.status);
        RAISE NOTICE 'T5 fn_order_after_status: logged new order as % in order_status_log', NEW.status;
        RETURN NULL;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_log (o_id, old_status, new_status) VALUES (NEW.o_id, OLD.status, NEW.status);
        RAISE NOTICE 'T5 fn_order_after_status: logged % -> % in order_status_log', OLD.status, NEW.status;

        IF NEW.status IN ('DELIVERED', 'CANCELLED') AND NEW.dp_id IS NOT NULL THEN
            UPDATE delivery_person SET is_available = TRUE WHERE dp_id = NEW.dp_id;
            RAISE NOTICE 'T5 fn_order_after_status: delivery person % is available again', NEW.dp_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-- T6. Fill payment fields from the order and compute the change
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
    RAISE NOTICE 'T6 fn_payment_fill: total %, paid %, change returned %', v_total, NEW.amount_paid, NEW.amount_returned;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
