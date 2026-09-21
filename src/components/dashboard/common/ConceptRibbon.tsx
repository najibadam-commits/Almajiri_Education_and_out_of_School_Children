/**
 * The concept-prototype ribbon.
 *
 * This is deliberately unmissable and must not be hidden or quietly softened:
 * every figure on the dashboard is invented for demonstration, and anyone
 * looking at the screen needs to know that without asking.
 */
export function ConceptRibbon() {
  return (
    <div className="ribbon" role="note">
      <span className="pill">CONCEPT PROTOTYPE</span>
      <span>
        <b>SAMPLE DATA ONLY.</b> Every school, figure and rating on this page is dummy data made up
        for demonstration. None of it is real Chigari Foundation or government data.
      </span>
    </div>
  );
}
