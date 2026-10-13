import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxField } from './CheckboxField';
import { Field } from './Field';
import { Notice } from './Notice';
import { RadioCards } from './RadioCards';
import { SelectField } from './SelectField';
import { TextAreaField } from './TextAreaField';
import { TextField } from './TextField';

describe('Field', () => {
  it('connects the label, hint and error to the control', () => {
    render(
      <Field label="Name" hint="As on your PAN" error="Enter a name">
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('As on your PAN Enter a name');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
  });

  it('leaves out the invalid state and description when there is nothing to say', () => {
    render(<Field label="Name">{(control) => <input {...control} />}</Field>);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('TextField', () => {
  it('is typed into like a normal input and marks required fields without native validation', async () => {
    const onChange = vi.fn();
    render(<TextField label="GSTIN" required value="" onChange={onChange} />);
    const input = screen.getByLabelText('GSTIN');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).not.toHaveAttribute('required');
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows its error', () => {
    render(<TextField label="PAN" value="x" onChange={() => {}} error="PAN looks like ABCDE1234F" />);
    expect(screen.getByLabelText('PAN')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('PAN looks like ABCDE1234F');
  });
});

describe('TextField wiring', () => {
  it('describes itself by its hint alone and is not invalid', () => {
    render(<TextField label="PAN" hint="Ten characters" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('PAN');
    expect(input).toHaveAccessibleDescription('Ten characters');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('cannot have the Field wiring overridden by caller props', () => {
    render(<TextField label="PAN" error="Bad" value="" onChange={() => {}} {...({ id: "mine", "aria-invalid": false } as object)} />);
    const input = screen.getByLabelText('PAN');
    expect(input).not.toHaveAttribute('id', 'mine');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'mh', label: 'Maharashtra', group: 'West' },
    { value: 'gj', label: 'Gujarat', group: 'West' },
    { value: 'tn', label: 'Tamil Nadu', group: 'South' },
    { value: 'x', label: 'Other' },
  ];

  it('renders a placeholder, groups and ungrouped options', async () => {
    const onChange = vi.fn();
    render(<SelectField label="State" options={options} placeholder="Choose a state" value="" onChange={onChange} />);
    const select = screen.getByLabelText('State');
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a state',
      'Maharashtra',
      'Gujarat',
      'Tamil Nadu',
      'Other',
    ]);
    expect(within(select).getAllByRole('group').map((group) => group.getAttribute('label'))).toEqual(['West', 'South']);
    await userEvent.selectOptions(select, 'tn');
    expect(onChange).toHaveBeenCalled();
  });

  it('puts options in the right optgroups', () => {
    render(<SelectField label="State" options={options} value="" onChange={() => {}} />);
    const [west, south] = within(screen.getByLabelText('State')).getAllByRole('group');
    expect(within(west!).getAllByRole('option').map((o) => o.textContent)).toEqual(['Maharashtra', 'Gujarat']);
    expect(within(south!).getAllByRole('option').map((o) => o.textContent)).toEqual(['Tamil Nadu']);
  });

  it('marks required and invalid states', () => {
    render(<SelectField label="State" options={options} required error="Pick one" value="" onChange={() => {}} />);
    const select = screen.getByLabelText('State');
    expect(select).toHaveAttribute('aria-required', 'true');
    expect(select).not.toHaveAttribute('required');
    expect(select).toHaveAttribute('aria-invalid', 'true');
  });

  it('works without a placeholder', () => {
    render(<SelectField label="State" options={options.slice(0, 2)} value="gj" onChange={() => {}} />);
    expect(screen.getByLabelText('State')).toHaveValue('gj');
    expect(within(screen.getByLabelText('State')).getAllByRole('option')).toHaveLength(2);
  });
});

describe('TextAreaField', () => {
  it('has a label and takes typed text', async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Notes" value="" onChange={onChange} hint="Printed on every invoice" />);
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Printed on every invoice');
    await userEvent.type(screen.getByLabelText('Notes'), 'x');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('TextAreaField required', () => {
  it('marks required without native validation', () => {
    render(<TextAreaField label="Notes" required value="" onChange={() => {}} />);
    const area = screen.getByLabelText('Notes');
    expect(area).toHaveAttribute('aria-required', 'true');
    expect(area).not.toHaveAttribute('required');
    expect(screen.getByText('Notes')).toHaveAttribute('data-required');
  });
});

describe('CheckboxField', () => {
  it('describes itself by the hint only without an error', () => {
    render(<CheckboxField label="RC" hint="Hint text" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'RC' })).toHaveAccessibleDescription('Hint text');
  });

  it('shows an error and includes it with the hint in the description', () => {
    render(<CheckboxField label="RC" hint="Hint text" error="Must accept" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Must accept');
    expect(screen.getByRole('checkbox', { name: 'RC' })).toHaveAccessibleDescription('Hint text Must accept');
  });

  it('keeps and extends a caller aria-describedby', () => {
    render(
      <>
        <p id="extra">Extra</p>
        <CheckboxField label="RC" hint="Hint text" aria-describedby="extra" checked={false} onChange={() => {}} />
      </>,
    );
    const box = screen.getByRole('checkbox', { name: 'RC' });
    expect(box.getAttribute('aria-describedby')?.split(' ')[0]).toBe('extra');
    expect(box).toHaveAccessibleDescription('Extra Hint text');
  });

  it('toggles and shows its hint', async () => {
    const onChange = vi.fn();
    render(<CheckboxField label="Reverse charge" hint="Tax is paid by the buyer" checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Reverse charge' });
    expect(box).toHaveAccessibleDescription('Tax is paid by the buyer');
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('RadioCards', () => {
  const options = [
    { value: 'regular', label: 'Regular GST registration', description: 'You charge GST on invoices.' },
    { value: 'unregistered', label: 'Not registered for GST', description: 'You issue plain invoices.' },
  ];

  it('is a labelled group of radios with descriptions', () => {
    render(<RadioCards legend="How are you registered?" name="status" value="regular" onChange={() => {}} options={options} />);
    const group = screen.getByRole('group', { name: 'How are you registered?' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Regular GST registration/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Not registered for GST/ })).not.toBeChecked();
    expect(screen.getByText('You issue plain invoices.')).toBeInTheDocument();
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    render(<RadioCards legend="Status" name="status" value={undefined} onChange={onChange} options={options} />);
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    expect(onChange).toHaveBeenCalledWith('unregistered');
  });

  it('shows an error for the group', () => {
    render(<RadioCards legend="Status" name="status" value={undefined} onChange={() => {}} options={options} error="Choose one" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose one');
    expect(screen.getByRole('group', { name: 'Status' })).toHaveAccessibleDescription('Choose one');
  });

  it('has no description without an error', () => {
    render(<RadioCards legend="Status" name="status" value={undefined} onChange={() => {}} options={options} />);
    expect(screen.getByRole('group', { name: 'Status' })).not.toHaveAttribute('aria-describedby');
  });
});

describe('Notice', () => {
  it('announces danger notices as alerts and others as status messages', () => {
    render(
      <>
        <Notice tone="danger" title="Could not save">Try again.</Notice>
        <Notice tone="info">Saved on this device.</Notice>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('alert')).toHaveTextContent('Try again.');
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this device.');
  });
});
