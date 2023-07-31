const sqlite3 = require("sqlite3");
const sqlite = require("./lib/sqlite");
const fs = require("fs/promises");

const createTableSql = `
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

const insertRecordSql = `
INSERT INTO csw_records
  (uuid, parent, title, abstract, purpose, owner, publisher, keywords, is_open, constraints, graphics, type, protocol, url, layer, spatial_type,    bbox,     crs,    spec, distributions, created, updated, published)
VALUES
  (   ?,      ?,     ?,        ?,       ?,     ?,         ?,  json(?),       ?,     json(?),  json(?),    ?,        ?,   ?,     ?,            ?, json(?), json(?), json(?),       json(?),       ?,       ?,         ?);
`;

async function run() {
  try {
    await fs.unlink("./db_.sqlite");
  } catch (err) {}
  try {
    await fs.unlink("./db_.sqlite-journal");
  } catch (err) {}

  console.log("Creating database...");
  const db = await sqlite.openAsync("./db_.sqlite", sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE);

  console.log("Creating table...");
  await db.runAsync(createTableSql);

  console.log("Preparing insert statement...");
  const stmt = await db.prepareAsync(insertRecordSql);

  console.log("Inserting records...");
  const files = await fs.readdir("./records");
  let nextLog = 10;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const data = await fs.readFile(`./records/${file}`, "utf8");

    const record = JSON.parse(data);
    await insert(record, stmt);

    const progress = Math.round((i / files.length) * 100);
    if (progress >= nextLog) {
      console.log(`Inserted ${i + 1} of ${files.length} records (${progress}%)`);
      nextLog += 10;
    }
  }
  console.log(`Inserted ${files.length} records.`);

  await stmt.finalizeAsync();

  console.log("Creating full text search table...");

  await db.runAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS csw_records_fts USING fts5(
        uuid, parent, title, abstract, purpose, owner, publisher, keywords, type, protocol, layer, graphics UNINDEXED, created UNINDEXED, updated UNINDEXED, published UNINDEXED, is_open UNINDEXED,
        prefix = 2
    );
  `);

  await db.runAsync(`
    INSERT INTO csw_records_fts
    SELECT uuid, parent, title, abstract, purpose, owner, publisher, keywords, type, protocol, layer, graphics, created, updated, published, is_open
    FROM csw_records;
  `);

  await db.closeAsync();
  console.log("Swapping databases...");
  try {
    await fs.unlink("./db_old.sqlite");
  } catch (e) {}
  try {
    await fs.rename("./db.sqlite", "./db_old.sqlite");
  } catch (e) {}
  await fs.rename("./db_.sqlite", "./db.sqlite");
  console.log("Done.");
}

run();

async function insert(record, stmt) {
  await stmt.runAsync(
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
    record.datePublished ?? null
  );
}
