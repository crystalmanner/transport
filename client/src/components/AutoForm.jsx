import { useState } from 'react';

/*
 * A form drawn from a list of field descriptions:
 *   { name, label, type, options, required, hint, wide, placeholder, min, max, step, show(values) }
 * type: text (default) | tel | password | number | date | datetime-local | textarea | select | checkbox | radio
 * options: [{ value, label, group? }] for select and radio; `group` builds <optgroup>s.
 * onSubmit(values) returns something truthy when it worked; with `resetOnSuccess` the form then clears.
 */
export default function AutoForm({ fields, initial = {}, onSubmit, submitLabel = 'Send', busy = false, resetOnSuccess = false, single = false, onCancel, children }) {
  const blank = () => Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? (field.type === 'checkbox' ? false : '')]));
  const [values, setValues] = useState(blank);
  const set = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const visible = Object.fromEntries(fields.filter((field) => !field.show || field.show(values)).map((field) => [field.name, values[field.name]]));
    const ok = await onSubmit(visible);
    if (ok && resetOnSuccess) setValues(blank());
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className={`form-grid${single ? ' single' : ''}`}>
        {fields.map((field) => (!field.show || field.show(values) ? <FormField key={field.name} field={field} value={values[field.name]} onChange={(value) => set(field.name, value)} /> : null))}
      </div>
      {children}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function FormField({ field, value, onChange }) {
  const { name, label, type = 'text', options = [], required = true, hint, wide, placeholder, min, max, step } = field;
  const wrap = `field${wide || type === 'textarea' ? ' wide' : ''}`;

  if (type === 'checkbox') {
    return (
      <label className={`check${wide ? ' wide' : ''}`}>
        <input type="checkbox" name={name} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
    );
  }

  if (type === 'radio') {
    return (
      <fieldset className={wrap}>
        <legend>{label}</legend>
        <div className="segmented">
          {options.map((option) => (
            <label key={option.value}>
              <input type="radio" name={name} value={option.value} checked={String(value) === String(option.value)} onChange={() => onChange(option.value)} required={required} />
              {option.label}
            </label>
          ))}
        </div>
        {hint && <small>{hint}</small>}
      </fieldset>
    );
  }

  let control;
  if (type === 'select') {
    const groups = [...new Set(options.map((option) => option.group).filter(Boolean))];
    control = (
      <select className="input" name={name} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">{required ? 'Choose…' : 'None'}</option>
        {groups.length === 0
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : groups.map((group) => (
              <optgroup key={group} label={group}>
                {options
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </optgroup>
            ))}
      </select>
    );
  } else if (type === 'textarea') {
    control = <textarea className="input" name={name} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} />;
  } else {
    control = (
      <input
        className="input"
        type={type}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        min={min ?? (type === 'number' ? 0 : undefined)}
        max={max}
        step={step ?? (type === 'number' ? 'any' : undefined)}
        inputMode={type === 'number' ? 'decimal' : undefined}
      />
    );
  }

  return (
    <label className={wrap}>
      <span>
        {label}
        {!required && <span className="muted"> (optional)</span>}
      </span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
