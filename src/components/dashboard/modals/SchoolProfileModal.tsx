'use client';

import { SampleDataBadge } from '@/components/dashboard/common/SampleDataBadge';
import {
  AGE_BANDS,
  CURRICULUM,
  DATA_REFERENCE_DATE,
  HEALTH,
  INFRASTRUCTURE,
} from '@/data/indicators';
import { fmt, formatVisitDate, hasBit, pct } from '@/lib/formatting';
import { useDashboard } from '@/state/DashboardProvider';
import { CloseButton, Modal } from './Modal';

/** A yes/no list over one indicator group's bits. */
function CheckList({ names, bits }: { names: readonly string[]; bits: number }) {
  return (
    <ul className="checks">
      {names.map((name, index) =>
        hasBit(bits, index) ? (
          <li key={name}>
            <span className="ok" aria-label="Yes">
              ✓
            </span>
            <span>{name}</span>
          </li>
        ) : (
          <li key={name}>
            <span className="no" aria-label="No">
              ✕
            </span>
            <span>{name}</span>
          </li>
        ),
      )}
    </ul>
  );
}

/** A labelled value with a proportional bar under it. */
function Meter({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="meter">
        <i style={{ width: `${width}%` }} />
      </div>
    </>
  );
}

/**
 * The school profile.
 *
 * Its information hierarchy is the prototype's and is what field staff
 * recognise: identity, then the four headline KPIs, then details, age bands,
 * curriculum, infrastructure and health.
 */
export function SchoolProfileModal() {
  const { profileSchool, openProfile, openFeedback, focusSchool, catalog } = useDashboard();
  const school = profileSchool;
  const close = () => openProfile(null);

  if (!school) return null;

  const ages: [string, number][] = [
    [AGE_BANDS[0], school.a1],
    [AGE_BANDS[1], school.a2],
    [AGE_BANDS[2], school.a3],
  ];

  return (
    <Modal open onClose={close} labelledBy="profTitle">
      <div className="dlg-head">
        <div>
          <h3 id="profTitle">{school.name}</h3>
          <div className="loc">
            {school.lgaName} LGA · {school.stateName} State · {school.zone}
          </div>
          <SampleDataBadge>SAMPLE RECORD · not real data</SampleDataBadge>
        </div>
        <CloseButton onClose={close} />
      </div>

      <div className="dlg-body">
        <div className="prof-grid">
          <div className="kpi">
            <div className="v">{fmt(school.pupils)}</div>
            <div className="l">
              Pupils ({fmt(school.boys)} boys, {fmt(school.girls)} girls)
            </div>
          </div>
          <div className="kpi">
            <div className="v">{school.mallams}</div>
            <div className="l">Mallams</div>
          </div>
          <div className="kpi">
            <div className="v">
              {school.mallams ? Math.round(school.pupils / school.mallams) : '—'}
            </div>
            <div className="l">Pupils per Mallam</div>
          </div>
          <div className="kpi">
            <div className="v">{school.rating || '—'}</div>
            <div className="l">Avg. rating ({school.nrat} reviews)</div>
          </div>
        </div>

        <div className="two">
          <div>
            <div className="blk">
              <h5>School details</h5>
              <div className="kv2">
                <span>School ID</span>
                <span>TSG-{school.id}</span>
                <span>Type</span>
                <span>{catalog.types[school.type]}</span>
                <span>Ownership</span>
                <span>{catalog.own[school.own]}</span>
                <span>Status</span>
                <span>{school.active ? 'Active' : 'Inactive'}</span>
                <span>Established</span>
                <span>{school.est}</span>
                <span>Chigari support</span>
                <span>{school.chig ? 'Supported' : 'Not yet supported'}</span>
                <span>Last visit</span>
                <span>{formatVisitDate(school.visit, DATA_REFERENCE_DATE)}</span>
                <span>Coordinates</span>
                <span>
                  {school.lat.toFixed(4)}, {school.lon.toFixed(4)}
                </span>
              </div>
            </div>

            <div className="blk">
              <h5>Pupils by age group</h5>
              {ages.map(([label, value]) => (
                <Meter
                  key={label}
                  label={label}
                  value={fmt(value)}
                  width={pct(value, school.pupils)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="blk">
              <h5>Curriculum integration</h5>
              <CheckList names={CURRICULUM} bits={school.integ} />
            </div>

            <div className="blk">
              <h5>Infrastructure &amp; WASH</h5>
              <CheckList names={INFRASTRUCTURE} bits={school.infra} />
            </div>

            <div className="blk">
              <h5>Health &amp; protection</h5>
              <CheckList names={HEALTH} bits={school.health} />
              <div style={{ marginTop: 8 }}>
                <Meter label="Pupils fully immunised" value={`${school.imm}%`} width={school.imm} />
                <Meter
                  label="Pupils seen street-begging"
                  value={`${school.beg}%`}
                  width={school.beg}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => {
              close();
              focusSchool(school, { forceMap: true });
            }}
          >
            Show on map
          </button>
          <button
            className="btn primary"
            onClick={() => {
              close();
              openFeedback(school);
            }}
          >
            Give feedback
          </button>
        </div>
      </div>
    </Modal>
  );
}
