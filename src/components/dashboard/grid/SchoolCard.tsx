'use client';

import { Stars } from '@/components/dashboard/common/Stars';
import type { SchoolRecord } from '@/data/types';
import { fmt } from '@/lib/formatting';

/**
 * A stand-in illustration for a school.
 *
 * There are no photographs in the sample dataset, so each card draws a shape
 * varied by the school's id. The caption says plainly that it is a
 * placeholder, so nobody mistakes it for a picture of the actual school.
 */
function PlaceholderImage({ school }: { school: SchoolRecord }) {
  const palettes = [
    [28, 60, 88],
    [22, 70, 52],
    [34, 58, 42],
    [48, 36, 70],
  ];
  const [r, g, b] = palettes[school.id % 4];

  return (
    <svg viewBox="0 0 300 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="300" height="140" fill={`rgb(${r},${g},${b})`} />
      <circle cx={240 - (school.id % 60)} cy="34" r="16" fill="rgba(255,220,140,.55)" />
      <path
        d={`M0 110 Q60 ${88 + (school.id % 14)} 130 104 T300 98 V140 H0Z`}
        fill="rgba(0,0,0,.25)"
      />
      <g transform={`translate(${95 + (school.id % 40)},52)`} fill="rgba(255,255,255,.82)">
        <rect x="0" y="22" width="80" height="44" rx="2" />
        <path d="M-8 24 40 0l48 24z" />
        <rect x="32" y="40" width="16" height="26" fill="rgba(0,0,0,.35)" />
        <rect x="10" y="32" width="12" height="10" fill="rgba(0,0,0,.25)" />
        <rect x="58" y="32" width="12" height="10" fill="rgba(0,0,0,.25)" />
      </g>
      <text
        x="150"
        y="132"
        textAnchor="middle"
        fill="rgba(255,255,255,.75)"
        fontSize="10"
        fontFamily="Poppins,Arial"
      >
        Photo placeholder
      </text>
    </svg>
  );
}

interface SchoolCardProps {
  school: SchoolRecord;
  typeLabel: string;
  onView: (school: SchoolRecord) => void;
  onFeedback: (school: SchoolRecord) => void;
}

export function SchoolCard({ school, typeLabel, onView, onFeedback }: SchoolCardProps) {
  return (
    <article className="school">
      <div className="ph">
        <PlaceholderImage school={school} />
        <span className="tag">{typeLabel}</span>
        {school.chig === 1 && <span className="sup">Chigari-supported</span>}
      </div>

      <div className="bd">
        <h4 title={school.name}>{school.name}</h4>
        <div className="loc">
          {school.lgaName.toUpperCase()} | {school.stateName}
        </div>

        <div className="meta">
          <span>
            <b>{fmt(school.pupils)}</b> pupils
          </span>
          <span>
            <b>{school.mallams}</b> Mallams
          </span>
          <span>{school.active ? 'Active' : 'Inactive'}</span>
        </div>

        <div className="stars" aria-label={`Average rating ${school.rating} of 5`}>
          <Stars rating={school.rating} />
          <span className="avg">
            {school.rating ? `Avg. rating ${school.rating}` : 'No ratings yet'}
          </span>
        </div>

        <div className="acts">
          <button className="btn" onClick={() => onView(school)}>
            View school
          </button>
          <button className="btn primary" onClick={() => onFeedback(school)}>
            Feedback
          </button>
        </div>
      </div>
    </article>
  );
}
