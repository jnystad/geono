# Find Norwegian spatial data

[geono.nystad.io](https://geono.nystad.io/) is an alternative web application for searching for data and services published on geonorge.no, the directory where various Norwegian government agencies publish their spatial data and service endpoints. The application is in Norwegian only.

As with my other similar project ([datanorge](https://github.com/jnystad/datanorge/)), it was implemented based on some thoughts on how the data can be made more readily available, especially for a GIS developer with the main goal of getting service URLs and data files.

The data is synced directly from the CSW service, and does not utilize Geonorge's own search APIs. Primarily since their indexed metadata is too denormalized for my intended use.

For interpreting what some of the CSW metadata means in context of Norway (constraints and restrictions, primarily), the open source [GeoNorgeAPI](https://github.com/kartverket/GeoNorgeAPI) .NET client was consulted. The presented restrictions should match geonorge.no fairly well.

However, their definition of "open data" is not necessarily something I will keep (for example the Norway Digital licensed data is restricted, but typically presented with a green open lock).

## Pros and cons

Note: This is entirely subjective and tailored to my own use of the directory.

### Improvements compared to geonorge.no

Less focus on the proprietary download solution, the out-of-context map solution, and product specifications, etc. More focus on the actual service URLs, protocols and a clearer distinction between the search result you selected and all the related datasets and services (but they are still one click away).

Since this is an SPA, and the data is cached in a sqlite database stored on my server, the time to switch results is also somewhat faster.

### Downsides compared to geonorge.no

Some of the metadata is not parsed from the CSW service and stored/indexed. This means some expected results for various keywords may not appear.

The related datasets and services are listed in a plain list with links, instead of having available shortcuts for download/use/preview in the same page.

For simplicity, the search functionality uses sqlite FTS5 as a search engine. It seems to work rather well on such a small dataset, but may return inferior results to the SOLR based engine on geonorge.no.

There are no utilities for downloading and previewing datasets and services (yet).

## Roadmap

- Add additional distributions information (file formats and atom feeds, mostly)
- Add an interactive map with preview of data for WMS and WMTS (and perhaps WFS, with limits)
- Consider listing supported projections based on GetCapabilities (metadata not always accurate)
- Add a solution for listing the files and URLs available via Atom feeds
