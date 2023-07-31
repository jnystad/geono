const jsdom = require("jsdom");
const fs = require("fs/promises");

async function prepare() {
  if (!(await fs.stat("./data"))) {
    throw new Error("No data to process.");
  }

  if (!(await fs.stat("./records"))) {
    await fs.mkdir("./records", { recursive: true });
    return;
  }

  const files = await fs.readdir("./records");
  for (const file of files) {
    await fs.unlink(`./records/${file}`);
  }
}

async function run() {
  console.log("Preparing records directory...");
  prepare();

  const files = await fs.readdir("./data");

  console.log(`Processing ${files.length} files...`);
  let nextLog = 10;
  for (let i = 0; i < files.length; ++i) {
    const file = files[i];

    await processFile(file);

    const progress = Math.round((i / files.length) * 100);
    if (progress >= nextLog) {
      console.log(`Processed ${i + 1} of ${files.length} files (${progress}%)`);
      nextLog += 10;
    }
  }
  console.log("Done!");
}

run();

async function processFile(file) {
  const data = await fs.readFile(`./data/${file}`, "utf8");
  const { id, json } = processData(data);
  await fs.writeFile(`./records/${id}.json`, json, "utf8");
}

function processData(data) {
  // Parse as HTML to avoid XML namespace handling.
  // This means selectors up to the last element must use lower case, and namespaces must be escaped into the
  // selector itself.
  const dom = new jsdom.JSDOM(data);
  const doc = dom.window.document;

  const metadata = extractMetadata(doc);
  const constraints = extractConstraints(doc);
  const graphics = extractGraphics(doc);
  const typeAndDistributionInfo = extractTypeAndDistributionInfo(doc);
  const dates = extractDates(doc);

  dom.window.close();

  const output = {
    ...metadata,
    constraints,
    graphics,
    ...typeAndDistributionInfo,
    ...dates,
  };
  return {
    id: metadata.id,
    json: JSON.stringify(output, null, 2),
  };
}

function extractDates(doc) {
  const dates = doc.querySelectorAll("gmd\\:identificationinfo gmd\\:citation gmd\\:date");
  let dateCreated;
  let dateUpdated;
  let datePublished;
  for (const date of dates) {
    const dateType = date.querySelector("gmd\\:CI_DateTypeCode")?.getAttribute("codeListValue");
    const dateValue = date.querySelector("gmd\\:date gco\\:Date")?.textContent.trim();

    if (!dateValue || dateValue.startsWith("0001-01-01")) continue;

    if (dateType === "creation") {
      dateCreated = dateValue;
    } else if (dateType === "revision") {
      dateUpdated = dateValue;
    } else if (dateType === "publication") {
      datePublished = dateValue;
    }
  }
  return { dateCreated, dateUpdated, datePublished };
}

function extractTypeAndDistributionInfo(doc) {
  const type = doc.querySelector("gmd\\:hierarchylevel gmd\\:MD_ScopeCode")?.getAttribute("codeListValue");
  const spec = {};
  if (type === "service") {
    const serviceType = doc.querySelector("srv\\:servicetype gco\\:LocalName")?.textContent.trim();
    spec.serviceType = serviceType;

    const operatesOn = Array.from(doc.querySelectorAll("srv\\:operatesOn")).map((el) => el.getAttribute("uuidref"));
    spec.operatesOn = operatesOn;
  } else if (type === "dataset") {
  }

  let spatialRepresentationType;
  const spatialRepresentation = doc.querySelector("gmd\\:spatialRepresentationType");
  if (spatialRepresentation) {
    spatialRepresentationType = spatialRepresentation
      .querySelector("gmd\\:MD_SpatialRepresentationTypeCode")
      ?.getAttribute("codeListValue");
  }

  let crs = [];
  const referenceSystems = doc.querySelectorAll("gmd\\:referenceSystemInfo");
  for (const system of referenceSystems) {
    const code = system.querySelector("gmd\\:code gco\\:CharacterString")?.textContent.trim();
    const anchor = system.querySelector("gmd\\:code gmx\\:Anchor")?.getAttribute("xlink:href");
    if (code) {
      crs.push(code);
    } else if (anchor) {
      crs.push(anchor);
    }
  }

  let bbox;
  const extent = doc.querySelector("gmd\\:EX_Extent");
  if (extent) {
    const west = extent.querySelector("gmd\\:westBoundLongitude");
    const east = extent.querySelector("gmd\\:eastBoundLongitude");
    const south = extent.querySelector("gmd\\:southBoundLatitude");
    const north = extent.querySelector("gmd\\:northBoundLatitude");
    if (west && east && south && north) {
      bbox = [
        parseFloat(west.textContent),
        parseFloat(south.textContent),
        parseFloat(east.textContent),
        parseFloat(north.textContent),
      ];
    }
  }

  let distribution = {};
  const distributionInfo = doc.querySelector("gmd\\:distributionInfo");
  if (distributionInfo) {
    const transferOpts = distributionInfo.querySelectorAll("gmd\\:transferOptions");
    for (const option of transferOpts) {
      const online = option.querySelector("gmd\\:CI_OnlineResource");
      if (online) {
        const url = online.querySelector("gmd\\:linkage gmd\\:URL")?.textContent.trim();
        const name = online.querySelector("gmd\\:name gco\\:CharacterString")?.textContent.trim();
        const protocol = online.querySelector("gmd\\:protocol gco\\:CharacterString")?.textContent.trim();

        if (url) {
          distribution = {
            url,
            name,
            protocol,
          };
        }
      }
    }
  }

  let distributionFormats = [];
  const distributionFormatsNode = Array.from(doc.querySelectorAll("gmd\\:distributionFormat"));
  for (const format of distributionFormatsNode) {
    const name = format.querySelector("gmd\\:name gco\\:CharacterString")?.textContent.trim();
    const version = format.querySelector("gmd\\:version gco\\:CharacterString")?.textContent.trim();

    if (name) {
      let transferOptions;
      const online = format.querySelector("gmd\\:CI_OnlineResource");
      if (online) {
        const url = online.querySelector("gmd\\:linkage gmd\\:URL")?.textContent.trim();
        const layer = online.querySelector("gmd\\:name gco\\:CharacterString")?.textContent.trim();
        const protocol = online.querySelector("gmd\\:protocol gco\\:CharacterString")?.textContent.trim();
        transferOptions = {
          url,
          layer,
          protocol,
        };
      }

      distributionFormats.push({
        name,
        version,
        ...transferOptions,
      });
    }
  }
  return {
    type,
    protocol: distribution.protocol,
    url: distribution.url,
    layer: distribution.name,
    spatialRepresentationType,
    bbox,
    crs,
    spec,
    distributionFormats,
  };
}

function extractGraphics(doc) {
  const graphics = [];
  const graphicOverview = doc.querySelectorAll("gmd\\:graphicoverview");
  for (const graphic of graphicOverview) {
    const fileName = graphic.querySelector("gmd\\:filename gco\\:CharacterString")?.textContent.trim();
    const fileDescription = graphic.querySelector("gmd\\:filedescription gco\\:CharacterString")?.textContent.trim();

    if (fileName && fileDescription) {
      graphics.push({
        url: fileName,
        type: fileDescription,
      });
    }
  }
  return graphics;
}

function extractConstraints(doc) {
  const constraints = {};
  const resourceConstraints = doc.querySelectorAll("gmd\\:resourceconstraints");
  for (const constraint of resourceConstraints) {
    const useLimitation = constraint.querySelector("gmd\\:uselimitation gco\\:CharacterString")?.textContent.trim();
    if (useLimitation) {
      constraints.useLimitation = useLimitation;
      continue;
    }

    const accessConstraints = constraint
      .querySelector("gmd\\:accessconstraints gmd\\:MD_RestrictionCode")
      ?.getAttribute("codeListValue");
    if (accessConstraints) {
      if (accessConstraints === "otherRestrictions") {
        const otherConstraints = Array.from(
          constraint.querySelectorAll("gmd\\:otherconstraints gco\\:CharacterString")
        );
        if (otherConstraints.length) {
          constraints.accessConstraints = otherConstraints.some((el) => el.textContent.trim() === "no restrictions")
            ? "no restrictions"
            : otherConstraints.map((el) => el.textContent.trim()).join(", ");
        } else {
          const otherConstraintsAnchors = Array.from(
            constraint.querySelectorAll("gmd\\:otherconstraints gmx\\:Anchor")
          );
          if (otherConstraintsAnchors.length) {
            constraints.accessConstraints = otherConstraintsAnchors[0].getAttribute("xlink:href");
          }
        }
      } else {
        constraints.accessConstraints = accessConstraints;
      }

      if (constraints.accessConstraints?.includes("noLimitations")) constraints.accessConstraints = "no restrictions";
      else if (constraints.accessConstraints?.includes("INSPIRE_Directive_Article13_1d"))
        constraints.accessConstraints = "norway digital restricted";
      else if (constraints.accessConstraints?.includes("INSPIRE_Directive_Article13_1e"))
        constraints.accessConstraints = "restricted";
    }

    const useConstraints = constraint
      .querySelector("gmd\\:useconstraints gmd\\:MD_RestrictionCode")
      ?.getAttribute("codeListValue");
    if (useConstraints) {
      constraints.useConstraints = useConstraints;

      const anchor = constraint.querySelector("gmd\\:otherconstraints gmx\\:Anchor");
      constraints.useConstraintsLink = anchor?.getAttribute("xlink:href");
      constraints.useConstraintsText = anchor?.textContent.trim();
      continue;
    }

    const otherConstraints = constraint.querySelector("gmd\\:otherconstraints gco\\:CharacterString");
    if (otherConstraints) {
      constraints.otherConstraints = otherConstraints.textContent.trim();
    }

    const securityConstraints = constraint
      .querySelector("gmd\\:md_securityconstraints gmd\\:MD_ClassificationCode")
      ?.getAttribute("codeListValue");
    if (securityConstraints) {
      constraints.securityConstraints = securityConstraints;
      const userNote = constraint.querySelector("gmd\\:usernote gco\\:CharacterString")?.textContent.trim();
      if (userNote) {
        constraints.securityConstraintsNote = userNote;
      }
    }
  }
  return constraints;
}

function extractMetadata(doc) {
  const id = doc.querySelector("gmd\\:fileidentifier").textContent.trim();
  const parentId = doc.querySelector("gmd\\:parentidentifier > gco\\:CharacterString")?.textContent.trim();
  const info = doc.querySelector("gmd\\:identificationInfo");
  const title = info.querySelector("gmd\\:title gco\\:CharacterString").textContent.trim();
  const abstract = info.querySelector("gmd\\:abstract gco\\:CharacterString")?.textContent.trim();
  const purpose = info.querySelector("gmd\\:purpose gco\\:CharacterString")?.textContent.trim();
  const keywords = Array.from(info.querySelectorAll("gmd\\:keyword gco\\:CharacterString")).map((el) =>
    el.textContent.trim()
  );

  let owner;
  let publisher;
  const contactInfo = doc.querySelectorAll("gmd\\:pointOfContact");
  for (const info of contactInfo) {
    const role = info.querySelector("gmd\\:CI_RoleCode").getAttribute("codeListValue");
    const organization = info.querySelector("gmd\\:organisationname gco\\:CharacterString");
    if (organization) {
      if (role === "owner") {
        owner = organization.textContent.trim();
      }
      if (role === "publisher") {
        publisher = organization.textContent.trim();
      }
    }
  }
  return { id, parentId, title, abstract, purpose, owner, publisher, keywords };
}
