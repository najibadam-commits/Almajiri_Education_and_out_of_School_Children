'use client';

import { useMemo } from 'react';
import { useDashboard } from '@/state/DashboardProvider';
import { ViewSwitcher } from './ViewSwitcher';

/**
 * The left filter panel: view switch, location filters and indicator groups.
 *
 * The indicator groups combine differently by design, and the note at the
 * foot of the panel is what tells the user which is which:
 * - Infrastructure, Curriculum and Health require every ticked item;
 * - Type, Ownership, Support and Status match any ticked item.
 */
export function FilterSidebar() {
  const {
    catalog,
    states,
    lgas,
    groups,
    state,
    setZone,
    setStateFilter,
    setLgaFilter,
    setCheck,
    reset,
  } = useDashboard();

  // States are listed alphabetically, narrowed to the selected zone.
  const stateOptions = useMemo(
    () =>
      states
        .map((props, index) => ({ name: props.name, zone: props.zone, index }))
        .filter((option) => !state.zone || option.zone === state.zone)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [states, state.zone],
  );

  // LGAs are listed alphabetically within the selected state.
  const lgaOptions = useMemo(() => {
    if (state.st === '') return [];
    const stateName = states[Number(state.st)]?.name;
    return lgas
      .map((props, index) => ({ name: props.name, state: props.state, index }))
      .filter((option) => option.state === stateName)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lgas, states, state.st]);

  return (
    <>
      <ViewSwitcher />

      <div className="sec-title">LOCATION</div>

      <div className="field">
        <label htmlFor="fZone">ZONE</label>
        <select id="fZone" value={state.zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">All zones</option>
          {catalog.zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="fState">STATE</label>
        <select id="fState" value={state.st} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">All states</option>
          {stateOptions.map((option) => (
            <option key={option.index} value={option.index}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="fLga">LGA</label>
        <select
          id="fLga"
          value={state.lga}
          disabled={state.st === ''}
          onChange={(e) => setLgaFilter(e.target.value)}
        >
          <option value="">All LGAs</option>
          {lgaOptions.map((option) => (
            <option key={option.index} value={option.index}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <button className="reset" onClick={reset}>
        Reset all filters
      </button>

      <div className="sec-title">INDICATOR</div>

      <label className="main-ind">
        <input type="checkbox" checked disabled /> ALMAJIRI / TSANGAYA SCHOOLS
      </label>

      <div className="acc">
        {groups.map((group) => {
          const picked = state.checks[group.key];
          return (
            <details key={group.key}>
              <summary>
                {group.title}
                <span className={`cnt${picked.length > 0 ? ' on' : ''}`}>{picked.length}</span>
              </summary>
              <div className="opts">
                {group.opts.map((option, index) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={picked.includes(index)}
                      onChange={(e) => setCheck(group.key, index, e.target.checked)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <p className="side-note">
        Ticking an item narrows every view. Within School Type, Ownership, Support and Status,
        schools matching any ticked option are shown. Within the other groups, schools must have
        every ticked item.
      </p>
    </>
  );
}
