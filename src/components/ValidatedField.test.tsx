import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidatedField } from '@/components/ValidatedField';

describe('ValidatedField', () => {
  it('renders error message with alert role', () => {
    render(
      <ValidatedField label="Email" error="Please enter a valid email address.">
        {(props) => <input {...props} type="email" value="" readOnly />}
      </ValidatedField>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Please enter a valid email address.');
  });

  it('sets aria-invalid when error is present', () => {
    render(
      <ValidatedField error="Required">
        {(props) => <input {...props} type="text" value="" readOnly data-testid="input" />}
      </ValidatedField>
    );

    expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows success indicator for valid field', () => {
    const { container } = render(
      <ValidatedField isValid showSuccess>
        {(props) => <input {...props} type="text" value="valid" readOnly />}
      </ValidatedField>
    );

    expect(container.querySelector('.text-green-500')).toBeTruthy();
  });
});
