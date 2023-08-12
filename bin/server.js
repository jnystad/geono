const express = require("express");
const sqlite3 = require("sqlite3");
const sqlite = require("./lib/sqlite");
const path = require("path");
const chokidar = require("chokidar");
const fs = require("fs/promises");

const dbFilePath = process.env.DB_FILE_PATH || path.join(__dirname, "./db.sqlite");

let db;

const app = express();

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
    const rows = await db.allAsync(sql, [
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
    const row = await db.getAsync(sql, [uuid]);

    const parent = row.parent ? await db.getAsync(sql, [row.parent]) : undefined;
    const childrenSql = `
      SELECT uuid, title, publisher, type, protocol, is_open, graphics
      FROM csw_records
      WHERE parent = ?
    `;
    const children = await db.allAsync(childrenSql, [uuid]);

    const operatedOnBySql = `
      SELECT r.uuid, r.title, r.publisher, r.type, r.protocol, r.is_open, r.graphics
      FROM csw_records AS r, json_each(r.spec->'operatesOn')
      WHERE ? = json_each.value
    `;
    const operatedOnBy = await db.allAsync(operatedOnBySql, [uuid]);

    let operatesOn = [];
    const spec = row.spec ? JSON.parse(row.spec) : undefined;
    if (spec?.operatesOn?.length) {
      const sqlMany = `
        SELECT *
        FROM csw_records
        WHERE uuid IN (${spec.operatesOn.map(() => "?").join(",")})
      `;
      operatesOn = await db.allAsync(sqlMany, spec.operatesOn);
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

app.get("/api/wms/capabilities/:uuid", async (req, res) => {
  const sql = `SELECT url, protocol FROM csw_records WHERE uuid = ?`;
  try {
    const row = await db.getAsync(sql, [req.params.uuid]);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!row.protocol.startsWith("OGC:WMS")) return res.status(400).json({ error: "Not a WMS" });
    const url = new URL(row.url);
    url.searchParams.set("service", "WMS");
    url.searchParams.set("request", "GetCapabilities");
    url.searchParams.set("version", "1.3.0");
    const response = await fetch(url.toString());
    if (!response.ok) return res.status(500).json({ error: "Failed to fetch GetCapabilities" });
    const text = await response.text();
    res.set("Content-Type", "application/xml");
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/wmts/capabilities/:uuid", async (req, res) => {
  const sql = `SELECT url, protocol FROM csw_records WHERE uuid = ?`;
  try {
    const row = await db.getAsync(sql, [req.params.uuid]);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!row.protocol.startsWith("OGC:WMTS")) return res.status(400).json({ error: "Not a WMTS" });
    const url = new URL(row.url);
    if (!row.url.endsWith(".xml")) {
      url.searchParams.set("service", "WMTS");
      url.searchParams.set("request", "GetCapabilities");
    }
    const response = await fetch(url.toString());
    if (!response.ok) return res.status(500).json({ error: "Failed to fetch GetCapabilities" });
    const text = await response.text();
    res.set("Content-Type", "application/xml");
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, async () => {
  const dbWatcher = chokidar.watch(dbFilePath, { awaitWriteFinish: true, ignoreInitial: true });

  try {
    db = await sqlite.openAsync(dbFilePath, sqlite3.OPEN_READONLY | sqlite3.OPEN_SHAREDCACHE);
    console.log("Database opened.");
  } catch (err) {
    console.error("Failed to open database:", err.message);
  }

  dbWatcher.on("all", async () => {
    try {
      await fs.stat(dbFilePath);
    } catch (err) {
      return;
    }

    console.log("Database changed, reopening...");
    if (db) await db.closeAsync();
    db = await sqlite.openAsync(dbFilePath, sqlite3.OPEN_READONLY | sqlite3.OPEN_SHAREDCACHE);
    console.log("Database reopened.");
  });

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
