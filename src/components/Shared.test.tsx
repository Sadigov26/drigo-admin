import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Table } from './Table';
import type { TableProps } from './Table';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';

type Row = { id: number; name: string };
function tableProps(overrides: Partial<TableProps<Row>> = {}): TableProps<Row> {
  return {
    caption: 'Cars', columns: [{ key: 'name', label: 'Name', sortable: true }],
    data: [{ id: 1, name: 'Toyota' }], rowKey: row => row.id,
    total: 12, page: 2, pageSize: 5, loading: false, error: null,
    search: '', sortBy: 'name', sortOrder: 'asc',
    onPageChange: vi.fn(), onSort: vi.fn(), onSearch: vi.fn(), onRetry: vi.fn(), ...overrides,
  };
}

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [method, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
  }
});

describe('shared table', () => {
  it('requests the adjacent page and toggles sorting with a page reset', async () => {
    const props = tableProps();
    render(<Table {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(props.onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(props.onSort).toHaveBeenCalledWith('name', 'desc');
    expect(props.onPageChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
  });

  it('passes search to the owner and resets pagination', () => {
    const props = tableProps();
    render(<Table {...props} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Tesla' } });
    expect(props.onSearch).toHaveBeenCalledWith('Tesla');
    expect(props.onPageChange).toHaveBeenCalledWith(1);
  });

  it('hides stale rows while loading and disables pagination', () => {
    render(<Table {...tableProps({ loading: true })} />);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(screen.queryByText('Toyota')).toBeNull();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows retry for an error and empty state for zero results', async () => {
    const props = tableProps({ error: 'Server unavailable' });
    const { rerender } = render(<Table {...props} />);
    expect(screen.getByRole('alert').textContent).toBe('Server unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    rerender(<Table {...props} error={null} data={[]} total={0} page={1} />);
    expect(screen.getByText('No results found.')).toBeTruthy();
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
  });

  it('corrects a page that disappears after a deletion', () => {
    const props = tableProps({ page: 3, total: 5 });
    render(<Table {...props} />);
    expect(props.onPageChange).toHaveBeenCalledWith(1);
  });

  it('uses the supplied cell renderer', () => {
    render(<Table {...tableProps({ columns: [{ key: 'name', label: 'Name', render: row => <strong>{row.name.toUpperCase()}</strong> }] })} />);
    expect(screen.getByText('TOYOTA').tagName).toBe('STRONG');
  });
});

describe('status badges', () => {
  it.each([['Active', 'success'], ['Checking', 'warning'], ['Blocked', 'danger'], ['Completed', 'info'], ['NewStatus', 'neutral']])
    ('renders %s with readable text and the expected tone', (status, tone) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(status).classList.contains('status-' + tone)).toBe(true);
    });
});

describe('modal lifecycle', () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open details</button><Modal isOpen={open} title="Details" onClose={() => setOpen(false)}><p>Modal content</p></Modal></>;
  }

  function mockDialog() {
    // jsdom does not implement the browser's native dialog methods.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); },
    });
  }

  it('opens with an accessible title, handles Escape/cancel and restores focus', async () => {
    mockDialog();
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open details' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes on a backdrop click but not content clicks', async () => {
    mockDialog();
    render(<Example />);
    await userEvent.click(screen.getByRole('button', { name: 'Open details' }));
    await userEvent.click(screen.getByText('Modal content'));
    const dialog = screen.getByRole('dialog');
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
