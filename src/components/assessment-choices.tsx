'use client';
import { useState } from 'react';
import { label } from '@/lib/assessment';
export function AssessmentChoices({
  name,
  options,
  initial,
}: {
  name: string;
  options: readonly string[];
  initial: string[];
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <>
      {options.map((value) => (
        <label className="assessment-choice" key={value}>
          <input
            type="checkbox"
            name={name}
            value={value}
            checked={selected.includes(value)}
            onChange={(e) =>
              setSelected((current) => {
                if (!e.target.checked) return current.filter((v) => v !== value);
                if (['unknown', 'none_known'].includes(value)) return [value];
                return [...current.filter((v) => !['unknown', 'none_known'].includes(v)), value];
              })
            }
          />
          {label(value)}
        </label>
      ))}
    </>
  );
}
