import { Router } from 'express';
import { q } from '../db.js';
import { h, HttpError, idParam, parse, v } from '../lib/http.js';

// Admin editing of the master data: provinces, transport offices, warehouses, parks, routes and news.
const router = Router();

// List / create / update / delete for one table. `check` can reject a body the field validators accept.
function crud(path, table, spec, listSql, check = () => {}) {
  router.get(
    path,
    h(async (req, res) => {
      res.json(await q(listSql));
    })
  );

  router.post(
    path,
    h(async (req, res) => {
      const body = parse(req.body, spec);
      check(body, req);
      const result = await q(`INSERT INTO ${table} SET ?`, [{ ...body, ...(table === 'news' ? { author_id: req.user.id } : {}) }]);
      res.status(201).json({ id: result.insertId });
    })
  );

  router.put(
    `${path}/:id`,
    h(async (req, res) => {
      const body = parse(req.body, spec);
      check(body, req);
      const result = await q(`UPDATE ${table} SET ? WHERE id = ?`, [body, idParam(req)]);
      if (result.affectedRows === 0) throw new HttpError(404, 'Not found.');
      res.json({ ok: true });
    })
  );

  router.delete(
    `${path}/:id`,
    h(async (req, res) => {
      await q(`DELETE FROM ${table} WHERE id = ?`, [idParam(req)]);
      res.json({ ok: true });
    })
  );
}

crud('/provinces', 'provinces', { name: v.str(100) }, 'SELECT id, name FROM provinces ORDER BY name');

crud(
  '/offices',
  'transport_offices',
  { province_id: v.int(1), name: v.str(150), address: v.str(255, 0), phone: v.str(30, 0) },
  `SELECT o.id, o.province_id, o.name, o.address, o.phone, pr.name AS province
   FROM transport_offices o JOIN provinces pr ON pr.id = o.province_id ORDER BY pr.name, o.name`
);

crud(
  '/warehouses',
  'warehouses',
  { office_id: v.int(1), name: v.str(150), address: v.str(255, 0), info: v.str(500, 0) },
  `SELECT w.id, w.office_id, w.name, w.address, w.info, o.name AS office
   FROM warehouses w JOIN transport_offices o ON o.id = w.office_id ORDER BY o.name, w.name`
);

crud(
  '/parks',
  'parks',
  { province_id: v.int(1), name: v.str(150), address: v.str(255, 0), working_time: v.str(100, 0), phone: v.str(30, 0) },
  `SELECT p.id, p.province_id, p.name, p.address, p.working_time, p.phone, pr.name AS province
   FROM parks p JOIN provinces pr ON pr.id = p.province_id ORDER BY pr.name, p.name`
);

crud(
  '/routes',
  'routes',
  { name: v.str(150), park_a_id: v.int(1), park_b_id: v.int(1), duration_minutes: v.int(1, 10000) },
  `SELECT r.id, r.name, r.park_a_id, r.park_b_id, r.duration_minutes, a.name AS park_a, b.name AS park_b
   FROM routes r JOIN parks a ON a.id = r.park_a_id JOIN parks b ON b.id = r.park_b_id ORDER BY r.name`,
  (body) => {
    if (body.park_a_id === body.park_b_id) throw new HttpError(400, 'A route needs two different parks.');
  }
);

crud(
  '/news',
  'news',
  { title: v.str(200), body: v.str(10000), pinned: v.bool() },
  `SELECT n.id, n.title, n.body, n.pinned, n.created_at, u.name AS author
   FROM news n LEFT JOIN users u ON u.id = n.author_id ORDER BY n.pinned DESC, n.id DESC`
);

export default router;
