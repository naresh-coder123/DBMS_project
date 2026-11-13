--Tables for the Food Delivery System (from the ER diagram) 

CREATE TABLE customer (
    cust_id     SERIAL PRIMARY KEY,
    fname       VARCHAR(50)  NOT NULL,         
    lname       VARCHAR(50),
    cust_cont   VARCHAR(15)  NOT NULL UNIQUE,
    cust_mail   VARCHAR(100) UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE restaurant (
    rest_id       SERIAL PRIMARY KEY,
    rest_name     VARCHAR(100) NOT NULL,
    rest_cont     VARCHAR(15)  NOT NULL,
    rest_address  TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Independent delivery partners: not tied to a restaurant, any free one can take any order
CREATE TABLE delivery_person (
    dp_id         SERIAL PRIMARY KEY,
    fname         VARCHAR(50)  NOT NULL,        -- DP_Name is composite: FName + LName
    lname         VARCHAR(50),
    dp_cont       VARCHAR(15)  NOT NULL UNIQUE,
    dp_mail       VARCHAR(100) UNIQUE,
    is_available  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Restaurant "offers" Menu_Item -> 1 : N
CREATE TABLE menu_item (
    menu_item_id   SERIAL PRIMARY KEY,
    rest_id        INT NOT NULL REFERENCES restaurant(rest_id),
    item_name      VARCHAR(100)  NOT NULL,
    item_category  VARCHAR(50),
    price          NUMERIC(10,2) NOT NULL CHECK (price > 0),
    is_available   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Customer "places", Restaurant "prepares", Delivery Person "picks" Order -> all 1 : N
CREATE TABLE orders (
    o_id          SERIAL PRIMARY KEY,
    cust_id       INT NOT NULL REFERENCES customer(cust_id),
    rest_id       INT NOT NULL REFERENCES restaurant(rest_id),
    dp_id         INT REFERENCES delivery_person(dp_id),       -- NULL until assigned
    o_addr        TEXT NOT NULL,
    o_date        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,            -- derived; maintained by trigger
    status        VARCHAR(20)   NOT NULL DEFAULT 'PLACED'
                  CHECK (status IN ('PLACED','PAID','OUT_FOR_DELIVERY','DELIVERED','CANCELLED')),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Order "has" Order Item (1 : N); Order Item "refers to" Menu_Item (N : 1)
-- Weak entity identified by (o_id, line_no). line_no and item_price are filled by trigger.
CREATE TABLE order_item (
    o_id          INT NOT NULL REFERENCES orders(o_id) ON DELETE CASCADE,
    line_no       INT NOT NULL,
    menu_item_id  INT NOT NULL REFERENCES menu_item(menu_item_id),
    quantity      INT NOT NULL CHECK (quantity BETWEEN 1 AND 50),
    item_price    NUMERIC(10,2) NOT NULL,                      -- price snapshot at order time
    PRIMARY KEY (o_id, line_no)
);

-- Customer "pays" Payment (1 : N); Order "has" Payment (1 : 1)
CREATE TABLE payment (
    pay_id           SERIAL PRIMARY KEY,
    o_id             INT NOT NULL UNIQUE REFERENCES orders(o_id),
    cust_id          INT NOT NULL REFERENCES customer(cust_id),
    total_amount     NUMERIC(10,2) NOT NULL,
    amount_paid      NUMERIC(10,2) NOT NULL,
    amount_returned  NUMERIC(10,2) NOT NULL DEFAULT 0,
    status           VARCHAR(10)   NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID','REFUNDED')),
    pay_date         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CHECK (amount_paid >= total_amount),
    CHECK (amount_returned = amount_paid - total_amount)
);

-- Audit trail written only by trigger
CREATE TABLE order_status_log (
    log_id      SERIAL PRIMARY KEY,
    o_id        INT NOT NULL REFERENCES orders(o_id) ON DELETE CASCADE,
    old_status  VARCHAR(20),
    new_status  VARCHAR(20) NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_item_rest   ON menu_item(rest_id);
CREATE INDEX idx_dp_available     ON delivery_person(is_available);
CREATE INDEX idx_orders_cust      ON orders(cust_id);
CREATE INDEX idx_orders_rest      ON orders(rest_id);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_status_log_order ON order_status_log(o_id);
