'use client';
import { useState } from 'react';
import { ScanWorkspace } from './scan-workspace';
export function DashboardImport({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details
      className="dashboard-import"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Add a history ZIP or individual reports</summary>
      <ScanWorkspace compact />
    </details>
  );
}
