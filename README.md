# ThisOne — Bus and Freight Transport System

A web system for passenger buses and freight transport. Passengers reserve bus seats and order freight transport; bus guards, truck drivers, warehouse managers and the admin each have their own side. It works on computers and on phones, with a dark theme.

- **Frontend:** React 18.3.1 (built with Vite)
- **Backend:** Node.js 22 with Express 4.19.2
- **Database:** MySQL (MariaDB from XAMPP)

All commands below are written as `npm.cmd`, which works in every Windows terminal. In Command Prompt you can also type `npm`.

---

## 1. Offline use

The system is made to run with **no internet connection**.

- The pages load nothing from the internet: no CDN, no web fonts, no icon fonts, no map, no analytics. Fonts are the device's own system fonts, icons are drawn inside the app, and charts are drawn by the app's own code.
- The browser talks only to this server (`/api/...`). The server talks only to MySQL on the same PC.
- There is no SMS, e-mail or online payment. Subscriptions are paid in cash and recorded by the admin.

**The one step that needs internet** is `npm.cmd install`, which downloads the packages into `node_modules`. It is needed once. After that, starting, building and using the system need no internet. To put the system on a PC that has never had internet, see [section 12](#12-moving-to-another-offline-pc).

**How to check it yourself:** unplug the network cable or turn off Wi-Fi internet, start the system, and use it. Or open the browser's developer tools (F12), open the Network tab and reload: every request goes to this PC's address.

If you search the built files in `client/dist` you will find a few `http://www.w3.org/...` texts and one `reactjs.org` text. These are names used inside React (XML namespaces and the text of an error message). The browser never opens them.

---

## 2. What you need

| Program | Version used | Note |
|---|---|---|
| Node.js | 22.23.3 | Runs the server and builds the pages |
| XAMPP (MySQL / MariaDB) | MariaDB 10.4.32 | Only the MySQL module is needed; Apache is not used |
| A browser | Any current Chrome, Edge, Firefox or Safari | On the PC and on phones |

---

## 3. First-time setup

Do these steps once.

1. **Start MySQL.** Open the XAMPP Control Panel and press *Start* next to MySQL.
2. **Open a terminal in the project folder** (the folder that contains this file).
3. **Install the packages** (needs internet, one time):
   ```
   npm.cmd install
   ```
4. **Check the database settings.** The file `server/.env` holds them. If it does not exist, copy `server/.env.example` to `server/.env`. The default values fit a fresh XAMPP (user `root`, no password).
5. **Create the database, the tables and the first admin:**
   ```
   npm.cmd run db:setup
   ```
   This is safe to run again; it never deletes anything.
6. **Optional: add demo data** so every screen has something to show:
   ```
   npm.cmd run db:seed
   ```
   It only works on an empty database, so it cannot mix into real data.
7. **Build the pages:**
   ```
   npm.cmd run build
   ```

### Settings in `server/.env`

| Name | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | Port of the server |
| `DB_HOST` | `localhost` | MySQL address |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | (empty) | MySQL password |
| `DB_NAME` | `thisone` | Database name |
| `ADMIN_PHONE` | `000000` | Phone of the first admin. Used only when no admin exists yet |
| `ADMIN_PASSWORD` | `admin123` | Password of the first admin. Used only when no admin exists yet |

---

## 4. Running the system

MySQL must be started in XAMPP first.

### Normal use

```
npm.cmd start
```

- On this PC open `http://localhost:4000`.
- Run `npm.cmd run build` again whenever files in `client/` were changed.
- To stop the server press `Ctrl + C` in the terminal.

### Using it from phones and other computers

1. The phone and the PC must be on the same network (the same Wi-Fi router is enough; the router does not need internet).
2. Find the PC's address: run `ipconfig` and read *IPv4 Address*, for example `192.168.1.20`.
3. On the phone open `http://192.168.1.20:4000`.
4. The first time, Windows Firewall may ask about Node.js. Allow it on private networks.

### Development

```
npm.cmd run dev
```

This starts the server (it restarts when server files change) and the Vite dev server (pages reload when client files change). Open `http://127.0.0.1:5173`.

To try the development pages on a phone, run `npm.cmd run dev:lan` inside the `client` folder instead of the client part of `npm.cmd run dev`.

---

## 5. Accounts

Login is **phone number + password**. Anyone can create a normal user account on the *Create an account* page.

| Phone | Password | Account |
|---|---|---|
| `000000` | `admin123` | Admin (created by `db:setup`) |

Change the admin password after the first login: *Account → Change your password*.

Demo accounts (only after `db:seed`), all with the password `demo1234`:

| Phone | Account |
|---|---|
| `1000001` | Normal user |
| `1000002` | Special user (paid subscription, 500 points) |
| `2000001`, `2000002`, `2000003` | Guards, each with a bus |
| `3000001`, `3000002` | Truck drivers, each with a truck |
| `4000001` | Warehouse manager of North Main Warehouse |
| `4000002` | Warehouse manager of Harbor Warehouse |

---

## 6. The pages

### First page (dashboard)

There are two separate first pages: one for computers and tablets, one for phones. The app picks one by screen width (below 768 px is the phone page). Both show:

- the manager news,
- a button for each side: User, Guard, Truck Driver, Warehouse Manager, Park,
- buttons for Transport Office Information and Park Information,
- the lucky draw and the user's reward points.

### Open to everyone (no login)

| Page | What it shows |
|---|---|
| Manager news | News written by the admin; pinned news stays on top |
| Transport Office Information | Offices by province with name, position and phone; each office lists its warehouses (name, position, what it stores). Search by office or warehouse name |
| Park Information | Parks by province with name, position, working time and phone; each park lists its buses (route, fare, departure, note). Search by park name and by bus route |

### User Side (every logged-in account)

| Function | What it does |
|---|---|
| Order Bus Seat | Search by route. Each bus shows number, route, departure park, departure time, free seats and fare. *Order* opens the bus drawing with free, reserved and in-use seats. Tap a free seat, enter the passenger's phone number, reserve. History with cancel |
| Urban Freight Transport | Order form: sender name and two phones, departure position and its special features, receiver name and phone, destination, freight rows (name, height, width, weight, count), number of cars, urgent, car arrival date and time, note. History |
| Long Distance Freight | The same form plus departure warehouse, destination warehouse, baggage claim (receiver collects or delivery) and who pays (sender or receiver). History |
| Status of Order | Every order the account sends or receives: pending, accepted or rejected, the real departure time, arrived or not, charge and payment. The receiver is found by phone number |
| Route Search | Buses on a route, ordered by the guard's rating, with the guard's phone. Keeps the search history |
| Bus Search | A bus by its number: guard and phone, status, departure park, arrival park, departure time and forecast arrival time. Keeps the search history |
| Guard Feedback | 1 to 5 stars and an optional comment for the guard of a bus the user rode. History |

### Guard Side (role Guard, needs a paid subscription)

| Function | What it does |
|---|---|
| Route Operation Information | The form follows the status of the bus. **Preparing:** departure park, direction, departure date and time. **Departed:** departure park, route, departure date and time. **Arrived:** arrival park, arrival date and time. History |
| Operate Daily Report | Route, direction, departure date, passengers count, repeat time count, repeat date count, and the fare counts: deferred payment, free of charge, count 1, count 2, count 3. History |
| Status of Order | **Seat status:** the bus drawing of a trip with who sits where; mark a walk-in passenger, confirm a reserved passenger is on the bus, or free a seat. **Seat design:** the seat designer (below). **Bus information:** bus number, model, route, fare, usual departure, note; and the guard's own rating |

**The seat designer.** Buses differ, so the guard draws the real bus:

- a floor grid of up to 30 rows and 10 columns, with buttons to add and remove rows and columns;
- each square is a seat, the driver, a door, a WC, stairs, or empty;
- an optional upper deck;
- seat numbers are given automatically, or typed by hand (up to 4 characters, each used once);
- templates to start from: coach 2 + 2, coach 2 + 1, sleeper on two decks, empty floor.

A trip keeps a copy of the design from the moment it opens, so changing the design later never moves seats that are already reserved.

### Truck Driver Side (role Truck Driver, needs a paid subscription)

| Function | What it does |
|---|---|
| Operating Status Information | Status of the car. **Preparing:** enter the current position and choose urban or long distance transport preparing. **Working, repairing, car downtime:** sent without input. History |
| Operate Daily Report | Departure position, arrival position, arrival date, go direction amount and come direction amount (tons), repeat count, current position. History |
| Transport Commands | Commands from the manager with the order details. *Allow* or *Not allow* (with a reason). For urban orders the driver then records the real departure and arrival. History |

### Warehouse Manager Side (role Warehouse Manager)

| Function | What it does |
|---|---|
| Ordered Freight | Long-distance orders that start at this warehouse. Accept (and set the charge) or reject (with a reason) |
| Sent and Arrived Status | Record the real departure time of freight leaving this warehouse, and the arrival of freight coming to it. Record cash payment |
| Daily Report | Freight brought in and freight removed: count, weight and details. History |

### Park Side

Shows "In preparation". It is not designed yet.

### Admin (role Admin)

| Page | What it does |
|---|---|
| Statistics | Total users, users using the system now, new users today, subscribed users, buses, cars, open trips, seats ordered today, pending orders and applications, subscription income. Charts: new users per day, orders per day, income per month, users by role, freight by status, buses and cars by status |
| Users | Search users; change name, role and warehouse; block or unblock; add or remove reward points; set a new password |
| Permissions | Approve or reject role applications. The table that decides which User Side functions Normal and Special users may use |
| News | Add, edit, pin and delete news |
| Buses | Every bus with guard, route, fare, seats, status, rating and subscription |
| Cars | Every truck with driver, status, position, waiting commands and subscription |
| Freight Orders | All orders with filters. Accept or reject, send a transport command to a driver, record departure and arrival, record cash payment |
| Payments | Who must pay and until when they have paid; record a subscription payment; payment history |
| Histories | Read-only logs: seat orders, bus status, guard reports, truck status, driver reports, transport commands, warehouse reports, reward points, guard feedback |
| Places and Routes | Provinces, parks, routes, transport offices, warehouses |
| Settings | Prices and rules (see section 8) |

---

## 7. How the main things work

### Roles

Everyone registers as a normal **User**. To become a Guard, Truck Driver or Warehouse Manager, the user opens *Account → Apply for a role* and enters the bus, the truck or the warehouse. The admin approves it on *Admin → Permissions*. The admin can also change a role directly on *Admin → Users*.

Every account can use the User Side. A guard, driver or warehouse manager also has their own side.

### Subscription and Special Users

- Guards and truck drivers must have a paid monthly subscription to use their side.
- A normal user with a paid subscription is a **Special User**.
- Payment is in cash. The admin records it on *Admin → Payments*; the months are added after the day already paid, or from today if the subscription has run out.
- What a Special User can do that a Normal user cannot is set in the table on *Admin → Permissions*. At the start, Route Search and Bus Search are for Special Users only; everything else is open to both.

### Reward points

| Event | Points (default) |
|---|---|
| Lucky draw, once per hour | A random 1 to 10 |
| Bus seat order | +5 |
| Freight order accepted | +10 |

- Points can pay for a bus seat or a freight charge. The cost is the amount divided by the "money value of one point", rounded up. With the default value 10, a fare of 1,500 costs 150 points.
- A seat paid with points gives no order points.
- Cancelling a seat gives back the points that were used and takes back the points that were earned.
- Every change is listed on *Account → Reward points*.

### A bus trip

1. The guard sends **Preparing**. This opens a trip, and users can reserve seats on it.
2. Users reserve seats. One user can reserve at most 5 seats on one bus (a setting). A reservation can be cancelled until the bus departs.
3. The guard sends **Departed**. Reservations close and the forecast arrival time is counted from the real departure time plus the route's travel time.
4. The guard sends **Arrived**. The trip is finished, and passengers of that trip can rate the guard, once each.

### A freight order

| Step | Urban order | Long-distance order |
|---|---|---|
| Accept or reject, set the charge | Admin | Manager of the departure warehouse (the admin can do it too) |
| Send the transport command to a truck driver | Admin | Admin |
| Allow or not allow the command | Truck driver | Truck driver |
| Record the real departure time | Truck driver (or admin) | Manager of the departure warehouse (or admin) |
| Record the arrival | Truck driver (or admin) | Manager of the destination warehouse (or admin) |

Status goes *Pending → Accepted → Departed → Arrived*, or *Rejected*, or *Cancelled* (by the sender while it is still pending). Payment is *Not paid*, *Paid with points* or *Paid in cash*.

### Security rules

- Passwords are stored only as salted hashes (scrypt). Login tokens are stored only as hashes.
- A login lasts 30 days. Ten wrong passwords for one phone number lock that number for 10 minutes.
- Every rule (role, subscription, permission table) is checked on the server, not only hidden on the screen.
- A user never sees another passenger's phone number on the seat map.

---

## 8. Admin settings

*Admin → Settings*:

| Setting | Default |
|---|---|
| Subscription price per month | 1000 |
| Currency unit shown after amounts | empty (numbers only) |
| Lucky draw: minutes between draws | 60 |
| Lucky draw: smallest and biggest prize | 1 and 10 |
| Points for a bus seat order | 5 |
| Points for an accepted freight order | 10 |
| Money value of one reward point | 10 |
| Most seats one user may reserve on one bus | 5 |

---

## 9. Project structure

```
ThisOne/
├─ package.json            scripts for the whole project (npm workspaces)
├─ .npmrc                  stops npm from contacting the internet when running scripts
├─ client/                 the pages (React)
│  ├─ index.html
│  ├─ vite.config.js       dev server settings; sends /api to the server
│  ├─ dist/                the built pages (made by "npm.cmd run build")
│  └─ src/
│     ├─ main.jsx          starts the app
│     ├─ App.jsx           the list of pages (routes)
│     ├─ styles/global.css the dark theme and shared styles
│     ├─ lib/              api.js (server calls), format.js, nav.js, seatLayout.js, breakpoints.js
│     ├─ hooks/            useFetch, useLookups, useMediaQuery
│     ├─ context/          Auth.jsx (login state), Toast.jsx (messages)
│     ├─ components/       shared parts: Shell (page frame), Gate (access checks), AutoForm,
│     │                    ui (table, modal, tabs, badges), SeatMap, SeatDesigner, Freight,
│     │                    charts, Icon, LuckyDraw, NewsList
│     └─ pages/
│        ├─ home/          the two first pages: HomeDesktop and HomeMobile
│        ├─ user/          User Side
│        ├─ guard/         Guard Side
│        ├─ driver/        Truck Driver Side
│        ├─ warehouse/     Warehouse Manager Side
│        ├─ admin/         Admin
│        └─ Login, Account, News, Info (offices, parks, Park Side), NotFound
└─ server/                 the API (Express)
   ├─ .env                 database settings (not shared; copy from .env.example)
   ├─ sql/schema.sql       all tables
   ├─ scripts/setup.js     creates database, tables, default settings, first admin
   ├─ scripts/seed.js      demo data
   └─ src/
      ├─ index.js          starts the server
      ├─ app.js            connects the routes; serves client/dist
      ├─ db.js             MySQL connection
      ├─ lib/              auth, http (validation, errors), settings, points, seats, layout, freight
      └─ routes/           auth, public, points, user, guard, driver, warehouse, admin, adminMaster, health
```

How the screen adapts: one set of pages for all sizes, written phone-first. Tables turn into cards on a phone, side menus turn into a scrolling row, windows open as bottom sheets, and a bottom tab bar replaces the top menu. Only the first page has two separate versions.

---

## 10. Database

27 tables, all created by `server/sql/schema.sql`.

| Group | Tables |
|---|---|
| Places | `provinces`, `transport_offices`, `warehouses`, `parks`, `routes` |
| Accounts | `users`, `sessions`, `role_applications`, `payments`, `point_transactions` |
| Site | `settings`, `feature_permissions`, `news` |
| Buses | `buses`, `trips`, `seat_reservations`, `bus_status_reports`, `guard_daily_reports`, `guard_feedback`, `search_history` |
| Trucks | `trucks`, `truck_status_reports`, `driver_daily_reports` |
| Freight | `freight_orders`, `freight_items`, `transport_commands`, `warehouse_daily_reports` |

You can look at the data with phpMyAdmin from XAMPP (start Apache too, then open `http://localhost/phpmyadmin`).

**Backup:** in phpMyAdmin choose the database `thisone`, then *Export*. To restore, *Import* the saved file.

---

## 11. API overview

Every address starts with `/api`. Logged-in requests send the header `Authorization: Bearer <token>`.

| Address | Who | Purpose |
|---|---|---|
| `/health` | everyone | Says whether the server and the database are up |
| `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/profile`, `/auth/password` | everyone / logged in | Accounts |
| `/home`, `/news`, `/config`, `/lookups`, `/offices`, `/parks` | everyone | First page, news, settings, lists, information pages |
| `/points`, `/points/draw` | logged in | Reward points and the lucky draw |
| `/user/...` | logged in | Trips and seats, reservations, searches, freight orders, feedback, role applications |
| `/guard/...` | Guard with subscription | Bus, seat design, status, daily reports, trip seats |
| `/driver/...` | Truck Driver with subscription | Truck, status, daily reports, commands |
| `/warehouse/...` | Warehouse Manager | Orders, sent and arrived, daily reports |
| `/admin/...` | Admin | Statistics, users, applications, permissions, settings, news, buses, cars, freight, payments, histories, places and routes |

Errors come back as `{ "error": "message", "code": "..." }` with a matching HTTP status.

---

## 12. Moving to another offline PC

The new PC needs Node.js and XAMPP installed (bring their installers on a USB stick).

1. Copy the **whole project folder, including `node_modules` and `client/dist`**, to the new PC. With `node_modules` copied, `npm.cmd install` is not needed, so no internet is needed. The new PC must be the same kind as this one (64-bit Windows), because a few build tools inside `node_modules` are made for one system.
2. Start MySQL in XAMPP.
3. Check `server/.env`.
4. Run `npm.cmd run db:setup` (and `npm.cmd run db:seed` if you want demo data). To bring the existing data instead, export the database on the old PC and import it on the new one (section 10).
5. Run `npm.cmd start`.

---

## 13. Problems and answers

| What you see | Reason and fix |
|---|---|
| `npm : File ...npm.ps1 cannot be loaded because running scripts is disabled` | A PowerShell security setting. Type `npm.cmd` instead of `npm`, or use Command Prompt |
| `'node' is not recognized` | Node.js is not installed, or the terminal was opened before installing. Install Node.js, then open a new terminal |
| The page says it could not load, or `/api/health` shows `"db":"down"` | MySQL is not running. Start it in the XAMPP Control Panel |
| `db:setup` ends with `ECONNREFUSED` | The same: MySQL is not running, or `server/.env` has the wrong port |
| `db:setup` ends with `Access denied` | Wrong `DB_USER` or `DB_PASSWORD` in `server/.env` |
| `Host 'localhost' is not allowed to connect to this MariaDB server` | MySQL's own account tables are damaged (this can happen when MySQL is started or stopped several times in a row, or the PC loses power). The project data is not affected. See "Repairing MySQL's account tables" below |
| `EADDRINUSE ... 4000` when starting | The server is already running in another terminal, or another program uses port 4000. Close it, or change `PORT` in `server/.env` |
| The page is empty or old after changing code | Run `npm.cmd run build` again, then reload the page |
| A phone cannot open the page | Use the PC's IP address, not `localhost`. Both must be on the same network. Allow Node.js in Windows Firewall |
| "Your monthly subscription is not active" on the Guard or Driver side | The admin records the payment on *Admin → Payments* |
| "This function is for Special Users" | Set on *Admin → Permissions*, or record a subscription payment for the user |
| "No warehouse is assigned to your account" | The admin chooses the warehouse on *Admin → Users* |

### Repairing MySQL's account tables

Use this only for the error `Host 'localhost' is not allowed to connect to this MariaDB server`. It puts back XAMPP's clean copies of four system tables, which resets the MySQL accounts to XAMPP's defaults (`root` with no password). It does not touch the `thisone` database.

1. Stop MySQL in the XAMPP Control Panel.
2. Copy the folder `xampp\mysql\data\mysql` to a safe place, as a backup.
3. From `xampp\mysql\backup\mysql` copy these 12 files into `xampp\mysql\data\mysql`, replacing the old ones: `global_priv`, `db`, `proxies_priv` and `tables_priv`, each with the endings `.frm`, `.MAD` and `.MAI`.
4. Start MySQL in the XAMPP Control Panel.

To avoid the problem: press *Start* once and wait until MySQL turns green, and press *Stop* before turning off the PC.

---

## 14. Not finished or still to decide

- **Park Side** is a placeholder page.
- **Count 1, count 2, count 3** in the guard's daily report are plain number fields. Their meaning is not decided yet.
- **Lists** show the newest records only (100 to 300 depending on the list). There are no page-number controls yet.
- **The screens are in English only.**
