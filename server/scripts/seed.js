// Optional demo data so every screen has something to show. Run after `npm run db:setup`.
// Does nothing when the database already has provinces, so it never mixes into real data.
import 'dotenv/config';
import { one, pool, q } from '../src/db.js';
import { hashPassword } from '../src/lib/auth.js';
import { defaultLayout, normalizeLayout } from '../src/lib/layout.js';

const PASSWORD = 'demo1234';

const pad = (n) => String(n).padStart(2, '0');
// Local 'YYYY-MM-DD HH:MM:00', `days` from today.
function at(days, time) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}:00`;
}

const insert = async (table, row) => (await q(`INSERT INTO ${table} SET ?`, [row])).insertId;

// A 2 + 1 minibus, to show that seat designs differ from bus to bus.
function minibusLayout() {
  let n = 0;
  const seat = () => ({ t: 'seat', n: String((n += 1)) });
  const cells = [[{ t: 'driver' }, null, null, { t: 'door' }]];
  for (let r = 0; r < 6; r += 1) cells.push([seat(), seat(), null, seat()]);
  cells.push([seat(), seat(), seat(), seat()]);
  return normalizeLayout({ decks: [{ name: 'Lower deck', rows: cells.length, cols: 4, cells }] });
}

try {
  if (await one('SELECT id FROM provinces LIMIT 1')) {
    console.log('The database already has data. Demo data was not added.');
    process.exit(0);
  }

  const admin = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const passwordHash = await hashPassword(PASSWORD);

  // --- Master data -----------------------------------------------------------
  const north = await insert('provinces', { name: 'North Province' });
  const central = await insert('provinces', { name: 'Central Province' });
  const south = await insert('provinces', { name: 'South Province' });

  const park = (province_id, name, address, working_time, phone) => insert('parks', { province_id, name, address, working_time, phone });
  const northgate = await park(north, 'Northgate Bus Park', '12 Station Road, Northgate', '05:00 - 22:00', '0210001000');
  const riverside = await park(north, 'Riverside Bus Park', '3 River Street, Riverside', '06:00 - 20:00', '0210002000');
  const centralPark = await park(central, 'Central Bus Park', '1 Main Square, Central City', '04:30 - 23:00', '0310001000');
  const market = await park(central, 'Market Street Bus Park', '88 Market Street, Central City', '06:00 - 21:00', '0310002000');
  const harbor = await park(south, 'Harbor Bus Park', '5 Dock Avenue, Harbor Town', '05:00 - 22:00', '0410001000');

  const route = (name, park_a_id, park_b_id, duration_minutes) => insert('routes', { name, park_a_id, park_b_id, duration_minutes });
  const northCentral = await route('Northgate - Central', northgate, centralPark, 180);
  const centralHarbor = await route('Central - Harbor', centralPark, harbor, 240);
  await route('Riverside - Market Street', riverside, market, 150);
  await route('Northgate - Harbor', northgate, harbor, 420);

  const office = (province_id, name, address, phone) => insert('transport_offices', { province_id, name, address, phone });
  const northOffice = await office(north, 'North Transport Office', '20 Station Road, Northgate', '0210009000');
  const centralOffice = await office(central, 'Central Transport Office', '7 Main Square, Central City', '0310009000');
  const southOffice = await office(south, 'South Transport Office', '9 Dock Avenue, Harbor Town', '0410009000');

  const warehouse = (office_id, name, address, info) => insert('warehouses', { office_id, name, address, info });
  const northMain = await warehouse(northOffice, 'North Main Warehouse', '22 Station Road, Northgate', 'Stores freight from Northgate and the northern villages');
  await warehouse(northOffice, 'Riverside Depot', '5 River Street, Riverside', 'Stores freight from the Riverside district');
  await warehouse(centralOffice, 'Central Warehouse', '9 Main Square, Central City', 'Stores freight from Central City');
  const harborWarehouse = await warehouse(southOffice, 'Harbor Warehouse', '11 Dock Avenue, Harbor Town', 'Stores freight from the port and Harbor Town');

  await insert('news', { title: 'Welcome to the transport system', body: 'Reserve bus seats, send freight and collect reward points. Open "User Side" to start.', pinned: 1, author_id: admin?.id ?? null });
  await insert('news', { title: 'New route: Northgate - Harbor', body: 'A direct bus between Northgate Bus Park and Harbor Bus Park starts next week. The trip takes about seven hours.', author_id: admin?.id ?? null });
  await insert('news', { title: 'Lucky draw every hour', body: 'Every user can press the lucky draw once per hour and win 1 to 10 reward points. Points can pay for bus seats and freight.', author_id: admin?.id ?? null });

  // --- Accounts --------------------------------------------------------------
  const user = (name, phone, extra = {}) => insert('users', { name, phone, password_hash: passwordHash, ...extra });
  const normalUser = await user('Demo User', '1000001', { points: 40 });
  const specialUser = await user('Special User', '1000002', { points: 500 });
  const guardA = await user('Guard Anna', '2000001', { role: 'guard' });
  const guardB = await user('Guard Boris', '2000002', { role: 'guard' });
  const guardC = await user('Guard Clara', '2000003', { role: 'guard' });
  const driverA = await user('Driver Dan', '3000001', { role: 'driver' });
  const driverB = await user('Driver Erik', '3000002', { role: 'driver' });
  await user('Warehouse North', '4000001', { role: 'warehouse', warehouse_id: northMain });
  await user('Warehouse South', '4000002', { role: 'warehouse', warehouse_id: harborWarehouse });

  // One paid month for everyone who needs a subscription.
  for (const id of [specialUser, guardA, guardB, guardC, driverA, driverB]) {
    await q(
      `INSERT INTO payments (user_id, months, amount, period_start, period_end, note, recorded_by)
       VALUES (?, 1, 1000, CURDATE(), CURDATE() + INTERVAL 1 MONTH - INTERVAL 1 DAY, 'Demo payment', ?)`,
      [id, admin?.id ?? null]
    );
    await q('UPDATE users SET subscription_until = CURDATE() + INTERVAL 1 MONTH - INTERVAL 1 DAY WHERE id = ?', [id]);
  }

  // --- Buses and trips -------------------------------------------------------
  const coach = defaultLayout(10);
  const shortCoach = defaultLayout(7);
  const minibus = minibusLayout();
  const bus = (guard_id, bus_number, model, route_id, fare, departure_time, design, note = '') =>
    insert('buses', { guard_id, bus_number, model, route_id, fare, departure_time, note, layout: JSON.stringify(design.layout), seat_count: design.seatCount });
  const busA = await bus(guardA, 'B-1001', 'Coach 45', northCentral, 1500, '08:00 every day', coach, 'Air conditioned');
  const busB = await bus(guardB, 'B-1002', 'Coach 33', northCentral, 1400, '10:00 every day', shortCoach);
  const busC = await bus(guardC, 'B-2001', 'Minibus 22', centralHarbor, 2200, '07:30 Mon - Sat', minibus, 'Luggage space is small');

  const trip = (row, design) => insert('trips', { direction: 'outbound', layout: JSON.stringify(design.layout), seat_count: design.seatCount, ...row });

  // Open for reservations.
  const openA = await trip({ bus_id: busA, guard_id: guardA, route_id: northCentral, departure_park_id: northgate, arrival_park_id: centralPark, departure_at: at(1, '08:00'), eta: at(1, '11:00'), fare: 1500 }, coach);
  await trip({ bus_id: busB, guard_id: guardB, route_id: northCentral, departure_park_id: northgate, arrival_park_id: centralPark, departure_at: at(1, '10:00'), eta: at(1, '13:00'), fare: 1400 }, shortCoach);
  await q("UPDATE buses SET status = 'preparing', status_at = NOW() WHERE id IN (?)", [[busA, busB]]);
  await q('INSERT INTO seat_reservations (trip_id, seat, user_id, phone, points_earned) VALUES (?, ?, ?, ?, 5)', [openA, '5', specialUser, '1000002']);
  await q("INSERT INTO seat_reservations (trip_id, seat, phone, status) VALUES (?, '1', '', 'occupied'), (?, '2', '', 'occupied')", [openA, openA]);

  // Finished yesterday: both demo users rode, one has rated the guard, the other still can.
  const doneC = await trip({ bus_id: busC, guard_id: guardC, route_id: centralHarbor, departure_park_id: centralPark, arrival_park_id: harbor, departure_at: at(-1, '07:30'), departed_at: at(-1, '07:35'), eta: at(-1, '11:35'), arrived_at: at(-1, '11:40'), status: 'arrived', fare: 2200 }, minibus);
  await q("UPDATE buses SET status = 'arrived', status_at = NOW() WHERE id = ?", [busC]);
  await q("INSERT INTO seat_reservations (trip_id, seat, user_id, phone, status, points_earned) VALUES (?, '3', ?, '1000001', 'occupied', 5), (?, '4', ?, '1000002', 'occupied', 5)", [doneC, normalUser, doneC, specialUser]);
  await insert('guard_feedback', { guard_id: guardC, user_id: specialUser, trip_id: doneC, stars: 5, comment: 'Friendly and on time.' });

  // --- Trucks ----------------------------------------------------------------
  await insert('trucks', { driver_id: driverA, plate_number: 'T-501', model: 'Light truck', capacity_tons: 2.5, status: 'preparing', prep_type: 'urban', current_position: 'Northgate, Station Road', status_at: at(0, '07:00') });
  await insert('trucks', { driver_id: driverB, plate_number: 'T-502', model: 'Heavy truck', capacity_tons: 12, status: 'preparing', prep_type: 'long', current_position: 'North Main Warehouse', status_at: at(0, '07:00') });

  // --- Freight orders --------------------------------------------------------
  const urban = await insert('freight_orders', {
    type: 'urban', user_id: normalUser, sender_name: 'Demo User', sender_phone: '1000001',
    departure_address: '14 Garden Street, Northgate', departure_features: 'Blue gate, second floor',
    receiver_name: 'Mr. Lee', receiver_phone: '5550101', destination_address: '40 Mill Road, Northgate',
    cars_count: 1, urgent: 1, car_arrive_at: at(1, '09:00'), note: 'Please call before arriving.',
  });
  await q("INSERT INTO freight_items (order_id, name, height, width, weight, count) VALUES (?, 'Wardrobe', 200, 120, 80, 1), (?, 'Boxes', 40, 40, 15, 12)", [urban, urban]);

  // Sent by the Special User to the Demo User's phone, so the receiver view has something to show.
  const long = await insert('freight_orders', {
    type: 'long', user_id: specialUser, sender_name: 'Special User', sender_phone: '1000002',
    departure_address: '2 Hill Road, Northgate', receiver_name: 'Demo User', receiver_phone: '1000001',
    destination_address: '18 Shore Lane, Harbor Town', cars_count: 1, urgent: 0, car_arrive_at: at(2, '14:00'),
    claim_condition: 'direct', payment_target: 'receiver', origin_warehouse_id: northMain, dest_warehouse_id: harborWarehouse,
  });
  await q("INSERT INTO freight_items (order_id, name, height, width, weight, count) VALUES (?, 'Rice sacks', 30, 60, 50, 20)", [long]);

  console.log('Demo data added. Every demo account uses the password: ' + PASSWORD);
  console.log('  1000001  Demo User (normal)        1000002  Special User (subscribed)');
  console.log('  2000001  Guard Anna (bus B-1001)   2000002  Guard Boris     2000003  Guard Clara');
  console.log('  3000001  Driver Dan (truck T-501)  3000002  Driver Erik');
  console.log('  4000001  Warehouse North           4000002  Warehouse South');
} finally {
  await pool.end();
}
