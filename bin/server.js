const express = require("express");
const sqlite3 = require("sqlite3").verbose();

process.chdir(__dirname);

const app = express();

const db = new sqlite3.Database("./db.sqlite", sqlite3.OPEN_READONLY | sqlite3.OPEN_SHAREDCACHE);

function dbGetAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function dbAllAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

app.get("/api/search", async (req, res) => {
  const { q, limit, offset } = req.query;
  const sql = `
    SELECT uuid, title, abstract, publisher, type, protocol, is_open, graphics,
      snippet(csw_records_fts, 2, '<b>', '</b>', '...', 64) AS snippet_title,
      snippet(csw_records_fts, 3, '<b>', '</b>', '...', 12) AS snippet_abstract
    FROM csw_records_fts
    WHERE csw_records_fts MATCH ? AND rank MATCH 'bm25(10.0, 1.0, 10.0, 5.0, 1.0, 2.0, 2.0, 3.0, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0)'
    ORDER BY rank * (CASE is_open WHEN 1 THEN 1.05 ELSE 1 END)
    LIMIT ?
    OFFSET ?
  `;
  try {
    const terms = (q || "")
      .replace(/[^\p{L}\p{N}]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    const rows = await dbAllAsync(sql, [
      terms.length === 0 ? "_" : `(${terms.join(" ")}) OR (${terms.map((term) => term + "*").join(" ")})`,
      parseInt(limit || "10"),
      parseInt(offset || "0"),
    ]);
    res.json(
      rows.map((row) => ({
        uuid: row.uuid,
        title: row.snippet_title || row.title,
        abstract: row.snippet_abstract || row.abstract,
        publisher: row.publisher,
        type: row.type,
        protocol: row.protocol,
        isOpen: row.is_open === 1,
        thumbnail: row.graphics ? JSON.parse(row.graphics).find((g) => g.type === "miniatyrbilde")?.url : undefined,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/id/:uuid", async (req, res) => {
  const { uuid } = req.params;
  const sql = `
    SELECT *
    FROM csw_records
    WHERE uuid = ?
  `;
  try {
    const row = await dbGetAsync(sql, [uuid]);

    const parent = row.parent ? await dbGetAsync(sql, [row.parent]) : undefined;
    const childrenSql = `
      SELECT uuid, title, publisher, type, protocol, is_open, graphics
      FROM csw_records
      WHERE parent = ?
    `;
    const children = await dbAllAsync(childrenSql, [uuid]);

    const operatedOnBySql = `
      SELECT r.uuid, r.title, r.publisher, r.type, r.protocol, r.is_open, r.graphics
      FROM csw_records AS r, json_each(r.spec->'operatesOn')
      WHERE ? = json_each.value
    `;
    const operatedOnBy = await dbAllAsync(operatedOnBySql, [uuid]);

    let operatesOn = [];
    const spec = row.spec ? JSON.parse(row.spec) : undefined;
    if (spec?.operatesOn?.length) {
      const sqlMany = `
        SELECT *
        FROM csw_records
        WHERE uuid IN (${spec.operatesOn.map(() => "?").join(",")})
      `;
      operatesOn = await dbAllAsync(sqlMany, spec.operatesOn);
    }

    res.json({
      uuid: row.uuid,
      type: row.type,
      title: row.title,
      abstract: row.abstract,
      purpose: row.purpose ?? undefined,
      owner: row.owner ?? undefined,
      publisher: row.publisher ?? undefined,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      constraints: row.constraints ? JSON.parse(row.constraints) : undefined,
      graphics: row.graphics ? JSON.parse(row.graphics) : undefined,
      protocol: row.protocol ?? undefined,
      url: row.url ?? undefined,
      layer: row.layer ?? undefined,
      spatialType: row.spatial_type ?? undefined,
      bbox: row.bbox ? JSON.parse(row.bbox) : undefined,
      crs: row.crs ? JSON.parse(row.crs) : undefined,
      spec: spec,
      distributions: row.distributions ? JSON.parse(row.distributions) : undefined,
      created: row.created ?? undefined,
      updated: row.updated ?? undefined,
      published: row.published ?? undefined,
      parent: parent ? toSummaryObject(parent) : undefined,
      children: children.map(toSummaryObject),
      operatedOnBy: operatedOnBy.map(toSummaryObject),
      operatesOn: operatesOn.map(toSummaryObject),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});

function toSummaryObject(row) {
  return {
    uuid: row.uuid,
    title: row.title,
    publisher: row.publisher,
    type: row.type,
    protocol: row.protocol,
    isOpen: row.is_open === 1,
    thumbnail: row.graphics ? JSON.parse(row.graphics).find((g) => g.type === "miniatyrbilde")?.url : undefined,
  };
}
