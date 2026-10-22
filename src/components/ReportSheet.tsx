// A09 Report a Concern: a sheet from S07 or A06. Goes privately to the safety team.
import { useState } from 'react';
import { Sheet } from '../layout/layout';
import { InlineAlert } from './ui';
import { Icon } from './Icon';
import { sendReport } from '../services';
import { toast } from '../data/ui';

const CATEGORIES = ['Lesson did not happen', 'Asked to pay outside Scale', 'Inappropriate message or behavior', 'Safety concern', 'Something else'];

export function ReportSheet({ open, onClose, reporterId, subjectUserId, subjectName, context }: { open: boolean; onClose: () => void; reporterId: string; subjectUserId: string; subjectName: string; context?: string }) {
  const [cat, setCat] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const first = subjectName.split(' ')[0];
  const close = () => {
    setCat(null);
    setDetails('');
    onClose();
  };
  return (
    <Sheet
      open={open}
      large
      title="Report a concern"
      onCancel={close}
      action={{
        label: 'Send',
        disabled: !cat,
        onClick: () => {
          sendReport(reporterId, subjectUserId, cat!, details);
          close();
          toast('Report sent to the Scale safety team', { icon: 'check' });
        },
      }}
    >
      <InlineAlert tone="danger" title="If someone is in danger, call 911 first">
        Then report here. Reports go to the Scale safety team, not to the teacher.
      </InlineAlert>
      <section className="stack-6">
        <h3 className="section-label" id="cat-h">
          What happened?
        </h3>
        <div className="group" role="radiogroup" aria-labelledby="cat-h">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cat === c} className="row row--single" onClick={() => setCat(c)}>
              <span className="row__text">
                <span className="row__title">{c}</span>
              </span>
              {cat === c && <Icon name="checkmark" size={20} />}
            </button>
          ))}
        </div>
      </section>
      <div>
        <label htmlFor="report-details" className="sr-only">
          Tell us what happened (optional)
        </label>
        <textarea id="report-details" className="plain-input" rows={3} placeholder="Tell us what happened (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <p className="helper">
          About {subjectName}
          {context ? ` · ${context}` : ''}. We reply within 24 hours. {first} is not told who reported unless you agree.
        </p>
      </div>
    </Sheet>
  );
}
