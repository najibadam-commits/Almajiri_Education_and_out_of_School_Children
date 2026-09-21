/**
 * Attribution for the boundary data, basemap and layout the prototype builds
 * on. These credits are a condition of using the underlying assets, so they
 * stay on the page for as long as the assets do.
 */
export function Credits() {
  return (
    <footer className="credits">
      Concept prototype prepared for Chigari Foundation.{' '}
      <b>All school records, counts, ratings and trends are randomly generated sample data.</b>{' '}
      School locations are random points inside real LGA areas. Boundaries:{' '}
      <a href="https://www.geoboundaries.org" target="_blank" rel="noopener noreferrer">
        geoBoundaries
      </a>{' '}
      (Runfola et al. 2020), from GRID3 Nigeria LGA boundaries, CC BY 4.0. Basemap © OpenStreetMap
      contributors, © CARTO. Chigari Foundation logo used for this proposal only. Dashboard layout
      modelled on the NPHCDA PHC infographic.
    </footer>
  );
}
