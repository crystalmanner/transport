-- Tables only. `npm run db:setup` creates the database named in server/.env and then runs this file.
-- To import by hand (phpMyAdmin), create and select the database first.
-- Every statement is safe to run again.

-- ---------------------------------------------------------------------------
-- Master data (managed by the admin)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provinces (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transport_offices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  province_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  FOREIGN KEY (province_id) REFERENCES provinces (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warehouses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  office_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  -- Which places this warehouse stores freight from.
  info VARCHAR(500) NOT NULL DEFAULT '',
  FOREIGN KEY (office_id) REFERENCES transport_offices (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  province_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  working_time VARCHAR(100) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  FOREIGN KEY (province_id) REFERENCES provinces (id)
) ENGINE=InnoDB;

-- A route runs between two parks. "outbound" is A to B, "return" is B to A.
CREATE TABLE IF NOT EXISTS routes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  park_a_id INT UNSIGNED NOT NULL,
  park_b_id INT UNSIGNED NOT NULL,
  -- Used for the forecast arrival time.
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  FOREIGN KEY (park_a_id) REFERENCES parks (id),
  FOREIGN KEY (park_b_id) REFERENCES parks (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('user', 'guard', 'driver', 'warehouse', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
  -- Only for role = warehouse.
  warehouse_id INT UNSIGNED NULL,
  points INT NOT NULL DEFAULT 0,
  last_draw_at DATETIME NULL,
  -- Last paid day. A user with a running subscription is a Special User.
  subscription_until DATE NULL,
  last_seen_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_applications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('guard', 'driver', 'warehouse') NOT NULL,
  -- JSON: the bus, truck or warehouse the applicant entered.
  data TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  admin_note VARCHAR(255) NOT NULL DEFAULT '',
  decided_by INT UNSIGNED NULL,
  decided_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Subscription payments, paid in cash and recorded by the admin.
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  months INT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  note VARCHAR(255) NOT NULL DEFAULT '',
  recorded_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS point_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  amount INT NOT NULL,
  reason VARCHAR(40) NOT NULL,
  ref_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Site configuration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  name VARCHAR(64) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- Which User Side functions a Normal user and a Special user may use.
CREATE TABLE IF NOT EXISTS feature_permissions (
  feature VARCHAR(64) PRIMARY KEY,
  label VARCHAR(150) NOT NULL,
  normal_allowed TINYINT(1) NOT NULL DEFAULT 1,
  special_allowed TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS news (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  author_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Buses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS buses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL UNIQUE,
  bus_number VARCHAR(30) NOT NULL UNIQUE,
  model VARCHAR(100) NOT NULL DEFAULT '',
  route_id INT UNSIGNED NULL,
  fare DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- Usual departure, free text such as "07:30 every day".
  departure_time VARCHAR(50) NOT NULL DEFAULT '',
  note VARCHAR(255) NOT NULL DEFAULT '',
  -- JSON seat design, see server/src/lib/layout.js.
  layout LONGTEXT NOT NULL,
  seat_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('idle', 'preparing', 'departed', 'arrived') NOT NULL DEFAULT 'idle',
  status_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guard_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bus_id INT UNSIGNED NOT NULL,
  guard_id INT UNSIGNED NOT NULL,
  route_id INT UNSIGNED NOT NULL,
  direction ENUM('outbound', 'return') NOT NULL DEFAULT 'outbound',
  departure_park_id INT UNSIGNED NOT NULL,
  arrival_park_id INT UNSIGNED NOT NULL,
  -- Planned departure, then the real one once the guard reports "departed".
  departure_at DATETIME NOT NULL,
  departed_at DATETIME NULL,
  eta DATETIME NULL,
  arrived_at DATETIME NULL,
  status ENUM('preparing', 'departed', 'arrived', 'cancelled') NOT NULL DEFAULT 'preparing',
  fare DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- Copy of the bus seat design when the trip opened, so a later redesign cannot move sold seats.
  layout LONGTEXT NOT NULL,
  seat_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (status, departure_at),
  FOREIGN KEY (bus_id) REFERENCES buses (id) ON DELETE CASCADE,
  FOREIGN KEY (guard_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes (id),
  FOREIGN KEY (departure_park_id) REFERENCES parks (id),
  FOREIGN KEY (arrival_park_id) REFERENCES parks (id)
) ENGINE=InnoDB;

-- History of what the guard sent on "Route Operation Information".
CREATE TABLE IF NOT EXISTS bus_status_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bus_id INT UNSIGNED NOT NULL,
  guard_id INT UNSIGNED NOT NULL,
  trip_id INT UNSIGNED NULL,
  status ENUM('preparing', 'departed', 'arrived') NOT NULL,
  park_id INT UNSIGNED NULL,
  route_id INT UNSIGNED NULL,
  direction ENUM('outbound', 'return') NULL,
  reported_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bus_id) REFERENCES buses (id) ON DELETE CASCADE,
  FOREIGN KEY (guard_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS seat_reservations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id INT UNSIGNED NOT NULL,
  seat VARCHAR(10) NOT NULL,
  -- NULL when the guard seats a walk-in passenger.
  user_id INT UNSIGNED NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  status ENUM('reserved', 'occupied', 'cancelled') NOT NULL DEFAULT 'reserved',
  -- 1 while the seat is held, NULL once cancelled. NULLs do not collide in the
  -- unique key, so a seat can be cancelled and sold again.
  active TINYINT NULL DEFAULT 1,
  points_used INT NOT NULL DEFAULT 0,
  points_earned INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_holder_per_seat (trip_id, seat, active),
  KEY (user_id, created_at),
  FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guard_daily_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  bus_id INT UNSIGNED NULL,
  route_id INT UNSIGNED NOT NULL,
  direction ENUM('outbound', 'return') NOT NULL,
  departure_date DATE NOT NULL,
  passengers_count INT UNSIGNED NOT NULL DEFAULT 0,
  repeat_time_count INT UNSIGNED NOT NULL DEFAULT 0,
  repeat_date_count INT UNSIGNED NOT NULL DEFAULT 0,
  deferred_count INT UNSIGNED NOT NULL DEFAULT 0,
  free_count INT UNSIGNED NOT NULL DEFAULT 0,
  count1 INT UNSIGNED NOT NULL DEFAULT 0,
  count2 INT UNSIGNED NOT NULL DEFAULT 0,
  count3 INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guard_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guard_feedback (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  trip_id INT UNSIGNED NOT NULL,
  stars TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(1000) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_rating_per_trip (user_id, trip_id),
  KEY (guard_id),
  FOREIGN KEY (guard_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS search_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  kind ENUM('route', 'bus') NOT NULL,
  query VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (user_id, kind, created_at),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Trucks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trucks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  driver_id INT UNSIGNED NOT NULL UNIQUE,
  plate_number VARCHAR(30) NOT NULL UNIQUE,
  model VARCHAR(100) NOT NULL DEFAULT '',
  capacity_tons DECIMAL(8, 2) NOT NULL DEFAULT 0,
  status ENUM('preparing', 'working', 'repairing', 'downtime') NOT NULL DEFAULT 'downtime',
  -- Only while status = preparing.
  prep_type ENUM('urban', 'long') NULL,
  current_position VARCHAR(255) NOT NULL DEFAULT '',
  status_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS truck_status_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  truck_id INT UNSIGNED NOT NULL,
  driver_id INT UNSIGNED NOT NULL,
  status ENUM('preparing', 'working', 'repairing', 'downtime') NOT NULL,
  prep_type ENUM('urban', 'long') NULL,
  position VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (truck_id) REFERENCES trucks (id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS driver_daily_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  driver_id INT UNSIGNED NOT NULL,
  truck_id INT UNSIGNED NULL,
  departure_position VARCHAR(255) NOT NULL,
  arrival_position VARCHAR(255) NOT NULL,
  arrive_date DATE NOT NULL,
  -- Cargo weight in tons, outbound and return.
  go_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  come_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  repeat_count INT UNSIGNED NOT NULL DEFAULT 0,
  current_position VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Freight
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS freight_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('urban', 'long') NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  sender_phone VARCHAR(30) NOT NULL,
  sender_phone2 VARCHAR(30) NOT NULL DEFAULT '',
  departure_address VARCHAR(255) NOT NULL,
  departure_features VARCHAR(255) NOT NULL DEFAULT '',
  receiver_name VARCHAR(100) NOT NULL,
  -- The receiver sees the order when this matches their account phone.
  receiver_phone VARCHAR(30) NOT NULL,
  destination_address VARCHAR(255) NOT NULL,
  cars_count INT UNSIGNED NOT NULL DEFAULT 1,
  urgent TINYINT(1) NOT NULL DEFAULT 0,
  car_arrive_at DATETIME NOT NULL,
  note VARCHAR(1000) NOT NULL DEFAULT '',
  -- Long-distance only.
  claim_condition ENUM('direct', 'delivery') NULL,
  payment_target ENUM('sender', 'receiver') NULL,
  origin_warehouse_id INT UNSIGNED NULL,
  dest_warehouse_id INT UNSIGNED NULL,
  status ENUM('pending', 'accepted', 'rejected', 'departed', 'arrived', 'cancelled') NOT NULL DEFAULT 'pending',
  reject_reason VARCHAR(255) NOT NULL DEFAULT '',
  decided_by INT UNSIGNED NULL,
  decided_at DATETIME NULL,
  -- Set when the order is accepted.
  charge DECIMAL(12, 2) NULL,
  payment_status ENUM('unpaid', 'points', 'cash') NOT NULL DEFAULT 'unpaid',
  points_used INT NOT NULL DEFAULT 0,
  departed_at DATETIME NULL,
  arrived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (user_id, created_at),
  KEY (receiver_phone),
  KEY (type, status),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
  FOREIGN KEY (dest_warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS freight_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  height DECIMAL(8, 2) NOT NULL DEFAULT 0,
  width DECIMAL(8, 2) NOT NULL DEFAULT 0,
  weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  count INT UNSIGNED NOT NULL DEFAULT 1,
  FOREIGN KEY (order_id) REFERENCES freight_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A command from the admin telling a truck driver to carry an order.
CREATE TABLE IF NOT EXISTS transport_commands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  driver_id INT UNSIGNED NOT NULL,
  issued_by INT UNSIGNED NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  status ENUM('pending', 'allowed', 'declined') NOT NULL DEFAULT 'pending',
  decline_reason VARCHAR(255) NOT NULL DEFAULT '',
  responded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY (driver_id, status),
  FOREIGN KEY (order_id) REFERENCES freight_orders (id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warehouse_daily_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  warehouse_id INT UNSIGNED NOT NULL,
  manager_id INT UNSIGNED NOT NULL,
  report_date DATE NOT NULL,
  -- Freight brought in.
  in_count INT UNSIGNED NOT NULL DEFAULT 0,
  in_weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  in_note VARCHAR(500) NOT NULL DEFAULT '',
  -- Freight removed.
  out_count INT UNSIGNED NOT NULL DEFAULT 0,
  out_weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  out_note VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
