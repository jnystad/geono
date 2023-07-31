const fs = require("fs/promises");
const jsdom = require("jsdom");
const { post } = require("./lib/request");

const url = "https://www.geonorge.no/geonetwork/srv/nor/csw";

const requestTemplate = `<?xml version="1.0" ?>
<csw:GetRecords
  service="CSW"
  version="2.0.2"
  resultType="results"
  startPosition="{startPosition}"
  maxRecords="{maxRecords}"
  outputSchema="csw:IsoRecord"
  xmlns:csw="http://www.opengis.net/cat/csw/2.0.2"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/cat/csw/2.0.2/CSW-discovery.xsd">
  <csw:Query typeNames="csw:Record">
    <csw:ElementSetName>full</csw:ElementSetName>
  </csw:Query>
</csw:GetRecords>
`;

async function prepare() {
  try {
    await fs.stat("./data");
  } catch (e) {
    await fs.mkdir("./data", { recursive: true });
    return;
  }

  for (const file of fs.readdirSync("./data")) {
    await fs.unlink(`./data/${file}`);
  }
}

async function run() {
  console.log("Preparing data directory...");
  await prepare();

  let total = -1;
  let next = 1;
  let nextLog = 10;
  const limit = 20;

  console.log("Downloading records...");
  while (next <= total || total === -1) {
    const body = requestTemplate.replace("{startPosition}", next).replace("{maxRecords}", limit);

    const xml = await post(url, body, "application/xml");
    const dom = new jsdom.JSDOM(xml, { contentType: "text/xml" });

    const results = dom.window.document.querySelector("csw\\:SearchResults");
    total = parseInt(results.getAttribute("numberOfRecordsMatched"));
    next = parseInt(results.getAttribute("nextRecord"));

    for (const record of results.querySelectorAll("gmd\\:MD_Metadata")) {
      const id = record.querySelector("gmd\\:fileIdentifier").textContent.trim();
      const file = `./data/${id}.xml`;
      await fs.writeFile(file, record.outerHTML, "utf8");
    }

    const complete = Math.round((next / total) * 100);
    if (complete >= nextLog) {
      console.log(`Downloaded ${next - 1} of ${total} (${complete}%)`);
      nextLog += 10;
    }
  }
  console.log("Done!");
}

run();
