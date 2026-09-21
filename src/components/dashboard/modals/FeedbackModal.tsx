'use client';

import { useState } from 'react';
import { Stars } from '@/components/dashboard/common/Stars';
import { useDashboard } from '@/state/DashboardProvider';
import { CloseButton, Modal } from './Modal';

const CATEGORIES = [
  'Learning & teaching',
  'Pupil welfare / feeding',
  'Health & hygiene',
  'Child protection concern',
  'Infrastructure',
  'Other',
];

const ROLES = [
  'Parent / guardian',
  'Community member',
  'Mallam / teacher',
  'Field officer',
  'Traditional / religious leader',
];

/**
 * The community feedback form.
 *
 * It does not send or store anything, and says so on the form. Wiring it to a
 * backend means posting these fields somewhere and changing that line — not
 * redesigning the form.
 */
export function FeedbackModal() {
  const { feedbackSchool, openFeedback, showToast } = useDashboard();
  const [rating, setRating] = useState(0);
  const school = feedbackSchool;

  function close() {
    openFeedback(null);
    setRating(0);
  }

  if (!school) return null;

  return (
    <Modal open onClose={close} labelledBy="fbTitle" small>
      <div className="dlg-head">
        <div>
          <h3 id="fbTitle">Feedback</h3>
          <div className="loc">
            {school.name} · {school.lgaName}, {school.stateName}
          </div>
        </div>
        <CloseButton onClose={close} />
      </div>

      <div className="dlg-body form">
        <label id="fbRatingLabel">Your rating</label>
        <div className="star-in" role="group" aria-labelledby="fbRatingLabel">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
            >
              <Stars rating={value <= rating ? 1 : 0} />
            </button>
          ))}
        </div>

        <label htmlFor="fbCat">Feedback about</label>
        <select id="fbCat" defaultValue={CATEGORIES[0]}>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>

        <label htmlFor="fbRole">I am a</label>
        <select id="fbRole" defaultValue={ROLES[0]}>
          {ROLES.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>

        <label htmlFor="fbTxt">Comment</label>
        <textarea id="fbTxt" placeholder="Describe what you observed" />

        <p className="side-note">Demo form: nothing is sent or saved.</p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              close();
              showToast('Thanks! In this demo, feedback isn’t sent or saved.');
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </Modal>
  );
}
