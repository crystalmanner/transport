import { Router } from 'express';
import { one, q } from '../db.js';
import { h, HttpError, idParam, like } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';

// Readable without logging in: the first page, news, and the two information pages.
const router = Router();

const NEWS_SQL = `
  SELECT n.id, n.title, n.body, n.pinned, n.created_at, u.name AS author
  FROM news n LEFT JOIN users u ON u.id = n.author_id`;

const provinceFilter = (req) => {
  const id = Number(req.query.province_id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

router.get(
  '/home',
  h(async (req, res) => {
    const [news, counts] = await Promise.all([
      q(`${NEWS_SQL} ORDER BY n.pinned DESC, n.id DESC LIMIT 8`),
      one(`SELECT
             (SELECT COUNT(*) FROM parks) AS parks,
             (SELECT COUNT(*) FROM transport_offices) AS offices,
             (SELECT COUNT(*) FROM buses) AS buses,
             (SELECT COUNT(*) FROM trips WHERE status = 'preparing') AS open_trips`),
    ]);
    res.json({ news, counts });
  })
);

router.get(
  '/news',
  h(async (req, res) => {
    res.json(await q(`${NEWS_SQL} ORDER BY n.pinned DESC, n.id DESC LIMIT 100`));
  })
);

router.get(
  '/news/:id',
  h(async (req, res) => {
    const item = await one(`${NEWS_SQL} WHERE n.id = ?`, [idParam(req)]);
    if (!item) throw new HttpError(404, 'News not found.');
    res.json(item);
  })
);

// Site settings for visitors who are not logged in (currency unit, subscription price, lucky draw rules).
router.get(
  '/config',
  h(async (req, res) => {
    res.json({ settings: await getSettings() });
  })
);

// Small lists that fill the dropdowns of the forms.
router.get(
  '/lookups',
  h(async (req, res) => {
    const [provinces, parks, routes, warehouses] = await Promise.all([
      q('SELECT id, name FROM provinces ORDER BY name'),
      q(`SELECT p.id, p.name, p.province_id, pr.name AS province
         FROM parks p JOIN provinces pr ON pr.id = p.province_id ORDER BY pr.name, p.name`),
      q(`SELECT r.id, r.name, r.duration_minutes, r.park_a_id, r.park_b_id, a.name AS park_a, b.name AS park_b
         FROM routes r JOIN parks a ON a.id = r.park_a_id JOIN parks b ON b.id = r.park_b_id ORDER BY r.name`),
      q(`SELECT w.id, w.name, o.name AS office, o.province_id, pr.name AS province
         FROM warehouses w
         JOIN transport_offices o ON o.id = w.office_id
         JOIN provinces pr ON pr.id = o.province_id
         ORDER BY pr.name, o.name, w.name`),
    ]);
    res.json({ provinces, parks, routes, warehouses });
  })
);

// Transport offices by province; `q` matches the office name or the name of one of its warehouses.
router.get(
  '/offices',
  h(async (req, res) => {
    const provinceId = provinceFilter(req);
    const text = String(req.query.q ?? '').trim().toLowerCase();

    const [offices, warehouses] = await Promise.all([
      q(
        `SELECT o.id, o.name, o.address, o.phone, o.province_id, pr.name AS province
         FROM transport_offices o JOIN provinces pr ON pr.id = o.province_id
         WHERE (? IS NULL OR o.province_id = ?)
         ORDER BY pr.name, o.name`,
        [provinceId, provinceId]
      ),
      q('SELECT id, office_id, name, address, info FROM warehouses ORDER BY name'),
    ]);

    const result = [];
    for (const office of offices) {
      const own = warehouses.filter((w) => w.office_id === office.id);
      const officeMatches = office.name.toLowerCase().includes(text);
      // When only a warehouse matched, show just the matching warehouses of that office.
      const shown = !text || officeMatches ? own : own.filter((w) => w.name.toLowerCase().includes(text));
      if (!text || officeMatches || shown.length > 0) result.push({ ...office, warehouses: shown });
    }
    res.json(result);
  })
);

// Parks by province with the buses that use each park; filters: park name and bus route name.
router.get(
  '/parks',
  h(async (req, res) => {
    const provinceId = provinceFilter(req);
    const route = String(req.query.route ?? '').trim();

    const [parks, buses] = await Promise.all([
      q(
        `SELECT p.id, p.name, p.address, p.working_time, p.phone, p.province_id, pr.name AS province
         FROM parks p JOIN provinces pr ON pr.id = p.province_id
         WHERE (? IS NULL OR p.province_id = ?) AND p.name LIKE ?
         ORDER BY pr.name, p.name`,
        [provinceId, provinceId, like(req.query.q)]
      ),
      q(
        `SELECT b.id, b.bus_number, b.fare, b.departure_time, b.note, r.name AS route, r.park_a_id, r.park_b_id
         FROM buses b JOIN routes r ON r.id = b.route_id
         WHERE r.name LIKE ?
         ORDER BY r.name, b.bus_number`,
        [like(route)]
      ),
    ]);

    const result = parks
      .map((park) => ({
        ...park,
        buses: buses
          .filter((bus) => bus.park_a_id === park.id || bus.park_b_id === park.id)
          .map(({ park_a_id, park_b_id, ...bus }) => bus),
      }))
      .filter((park) => !route || park.buses.length > 0);
    res.json(result);
  })
);

export default router;
