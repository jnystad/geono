const sqlite3 = require("sqlite3").verbose();
const fs = require("fs/promises");

const createTable = `
CREATE TABLE IF NOT EXISTS csw_records (
  uuid TEXT PRIMARY KEY,
  parent TEXT,
  title TEXT,
  abstract TEXT,
  purpose TEXT,
  owner TEXT,
  publisher TEXT,
  keywords TEXT,
  is_open INTEGER,
  constraints TEXT,
  graphics TEXT,
  type TEXT,
  protocol TEXT,
  url TEXT,
  layer TEXT,
  spatial_type TEXT,
  bbox TEXT,
  crs TEXT,
  spec TEXT,
  distributions TEXT,
  created TEXT,
  updated TEXT,
  published TEXT
);
`;

const insertRecord = `
INSERT INTO csw_records
(uuid, parent, title, abstract, purpose, owner, publisher, keywords, is_open, constraints, graphics, type, protocol, url, layer, spatial_type,    bbox,     crs,    spec, distributions, created, updated, published)
VALUES
(   ?,      ?,     ?,        ?,       ?,     ?,         ?,  json(?),       ?,     json(?),  json(?),    ?,        ?,   ?,     ?,            ?, json(?), json(?), json(?),       json(?),       ?,       ?,         ?);
`;

async function run() {
  fs.unlink("./db_.sqlite").catch(() => {});
  console.log("Creating database...");
  let ready = false;
  const db = new sqlite3.Database("./db_.sqlite", sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.log("Error opening database:", err);
    }
    ready = true;
  });

  while (!ready) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  function run(sql) {
    return new Promise((resolve, reject) => {
      db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  function prepare(sql) {
    return new Promise((resolve, reject) => {
      db.prepare(sql, function (err) {
        const stmt = this;
        if (err) {
          reject(err);
        } else {
          console.log("Prepared statement.", stmt);
          resolve(stmt);
        }
      });
    });
  }

  await run("DROP TABLE IF EXISTS csw_records");

  console.log("Creating table...");
  await run(createTable);

  console.log("Preparing insert statement...");
  const stmt = await prepare(insertRecord);

  function insert(record) {
    return new Promise((resolve, reject) => {
      stmt.run(
        record.id,
        record.parentId ?? null,
        record.title ?? null,
        record.abstract ?? null,
        record.purpose ?? null,
        record.owner ?? null,
        record.publisher ?? null,
        JSON.stringify(record.keywords ?? []),
        record.constraints?.accessConstraints === "no restrictions" ? 1 : 0,
        JSON.stringify(record.constraints ?? {}),
        JSON.stringify(record.graphics ?? []),
        record.type ?? null,
        record.protocol ?? null,
        record.url ?? null,
        record.layer ?? null,
        record.spatialRepresentationType ?? null,
        JSON.stringify(record.bbox ?? null),
        JSON.stringify(record.crs ?? []),
        JSON.stringify(record.spec ?? {}),
        JSON.stringify(record.distributionFormats ?? []),
        record.dateCreated ?? null,
        record.dateUpdated ?? null,
        record.datePublished ?? null,
        (err) => {
          if (err) {
            console.log("Error inserting record:", err);
            reject(err);
          }
          resolve();
        }
      );
    });
  }

  console.log("Inserting records...");
  const files = await fs.readdir("./records");
  for (const file of files) {
    const data = await fs.readFile(`./records/${file}`, "utf8");

    const record = JSON.parse(data);
    console.log("Inserting record...", record.id);
    await insert(record);
  }

  stmt.finalize();

  console.log("Creating full text search table...");

  await run(`
    DROP TABLE IF EXISTS csw_records_fts;
  `);

  await run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS csw_records_fts USING fts5(
        uuid, parent, title, abstract, purpose, owner, publisher, keywords, type, protocol, layer, graphics UNINDEXED, created UNINDEXED, updated UNINDEXED, published UNINDEXED, is_open UNINDEXED,
        prefix = 2
    );
  `);

  await run(`
    INSERT INTO csw_records_fts
    SELECT uuid, parent, title, abstract, purpose, owner, publisher, keywords, type, protocol, layer, graphics, created, updated, published, is_open
    FROM csw_records;
  `);

  db.close(() => {
    fs.unlink("./db_old.sqlite").catch(() => {});
    fs.rename("./db.sqlite", "./db_old.sqlite").catch(() => {});
    fs.rename("./db_.sqlite", "./db.sqlite");
    console.log("Done.");
  });
}

run();
