const https = require("https");
const fs = require("fs");
const jsdom = require("jsdom");

function post(url, dataString) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      "Content-Length": dataString.length,
    },
    timeout: 60000, // in ms
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const body = [];
      res.on("data", (chunk) => body.push(chunk));
      res.on("end", () => {
        const resString = Buffer.concat(body).toString();

        if (res.statusCode < 200 || res.statusCode > 299) {
          console.log(resString);
          return reject(new Error(`HTTP status code ${res.statusCode}`));
        }
        resolve(resString);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request time out"));
    });

    req.write(dataString);
    req.end();
  });
}

async function run() {
  const url = "https://www.geonorge.no/geonetwork/srv/nor/csw";
  const requestTemplate = `<?xml version="1.0" ?>
<csw:GetRecords
  service="CSW"
  version="2.0.2"
  resultType="results"
  startPosition="{startPosition}"
  maxRecords="{maxRecords}"
  outputSchema="http://www.isotc211.org/2005/gmd"
  xmlns:csw="http://www.opengis.net/cat/csw/2.0.2"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/cat/csw/2.0.2/CSW-discovery.xsd">
  <csw:Query typeNames="csw:Record">
		<csw:ElementSetName>full</csw:ElementSetName>
  </csw:Query>
</csw:GetRecords>
`;

  fs.mkdirSync("./data", { recursive: true });

  let total = 10000;
  let next = 1001;
  const limit = 20;
  while (next <= total) {
    const body = requestTemplate
      .replace("{startPosition}", next)
      .replace("{maxRecords}", limit);

    const xml = await post(url, body);
    const dom = new jsdom.JSDOM(xml, { contentType: "text/xml" });

    const results = dom.window.document.querySelector("csw\\:SearchResults");
    total = parseInt(results.getAttribute("numberOfRecordsMatched"));
    next = parseInt(results.getAttribute("nextRecord"));

    for (const record of results.querySelectorAll("gmd\\:MD_Metadata")) {
      const id = record
        .querySelector("gmd\\:fileIdentifier")
        .textContent.trim();
      const file = `./data/${id}.xml`;
      // Write valid xml with namespaces resolved on root node
      fs.writeFileSync(file, record.outerHTML, "utf8");
    }

    console.log({ total, next });
  }
}

run();
