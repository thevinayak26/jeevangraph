'use client';
import { useState, useEffect } from 'react';
import { ScanWorkspace } from './scan-workspace';
export function DashboardImport({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  useEffect(() => {
    const finish = () => setOpen(false);
    window.addEventListener('jeevangraph:import-complete', finish);
    return () => window.removeEventListener('jeevangraph:import-complete', finish);
  }, []);
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
