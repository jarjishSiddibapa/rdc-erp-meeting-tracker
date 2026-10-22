import { useState, useCallback } from 'react';
import { message } from 'antd';
import { srAPI } from '../services/api';
import SRDetail from './SRDetail';

// Opens the standard SR detail/edit modal from anywhere a row can be clicked (the Reports tabs, the
// Resolution Insights drawer) with the same close / reopen / hold / delete behaviour as the SR page.
// `onChanged` runs after any change so the caller can reload its own figures.
export default function useSRDetailPanel(onChanged) {
  const [sr, setSR] = useState(null);
  const [open, setOpen] = useState(false);

  const openDetail = useCallback(async (id) => {
    try {
      const res = await srAPI.get(id);
      setSR(res.data);
      setOpen(true);
    } catch { message.error('Failed to load details'); }
  }, []);

  async function run(action, success) {
    try {
      await action();
      message.success(success);
      onChanged?.();
    } catch (e) { message.error(e.response?.data?.message || 'Action failed'); }
  }

  const detail = (
    <SRDetail
      sr={sr}
      open={open}
      onClose={() => setOpen(false)}
      onUpdated={updated => { setSR(updated); onChanged?.(); }}
      onCloseSR={row => run(() => srAPI.close(row.id), `${row.sr_number} closed`)}
      onReopenSR={row => run(() => srAPI.reopen(row.id), `${row.sr_number} reopened`)}
      onSetOnHold={row => run(() => srAPI.update(row.id, { status: 'On Hold' }), `${row.sr_number} put on hold`)}
      onDelete={id => run(() => srAPI.delete(id), 'Deleted')}
    />
  );

  return { openDetail, detail };
}
