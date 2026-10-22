import { useEffect, useMemo, useState } from 'react';
import { Drawer, Button, Grid, Space, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { resolutionAPI } from '../services/api';
import ResolutionRecordsTable, { recordsToSheet } from './ResolutionRecordsTable';
import { exportWorkbook } from '../utils/resolutionExport';
import { formatDuration } from '../utils/duration';
import { percentile } from '../utils/stats';

const { Text } = Typography;

// Opens when a bar, row or cell of a chart/table is clicked: lists the individual SRs behind it.
// `target` is { title, predicate } (null = closed); `params` are the page's current filters, so the list
// always agrees with the figures it was opened from.
export default function ResolutionDrilldown({ target, params, onClose, openSR }) {
  const screens = Grid.useBreakpoint();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!target) return undefined;
    let cancelled = false;
    setLoading(true);
    resolutionAPI.records({ ...JSON.parse(paramsKey), state: 'all' })
      .then(res => { if (!cancelled) setRecords(res.data.records); })
      .catch(() => message.error('Failed to load the SRs'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target, paramsKey]);

  const matching = useMemo(() => (target ? records.filter(target.predicate) : []), [records, target]);
  const tats = useMemo(() => matching.filter(r => r.resolved).map(r => r.tat_minutes).sort((a, b) => a - b), [matching]);
  const open = matching.filter(r => r.status !== 'Closed').length;
  const average = tats.length ? tats.reduce((sum, v) => sum + v, 0) / tats.length : null;

  return (
    <Drawer
      title={target?.title} open={!!target} onClose={onClose} width={screens.lg ? 920 : '100%'} destroyOnHidden
      extra={(
        <Button
          icon={<DownloadOutlined />} disabled={!matching.length}
          onClick={() => exportWorkbook('Resolution_drilldown', [{ name: 'SRs', rows: recordsToSheet(matching) }])}
        >
          Export
        </Button>
      )}
    >
      <Space size={20} wrap style={{ marginBottom: 14 }}>
        <Text><b>{matching.length}</b> SRs</Text>
        {tats.length > 0 && <Text><b>{tats.length}</b> closed, average <b>{formatDuration(average)}</b>, median <b>{formatDuration(percentile(tats, 0.5))}</b></Text>}
        {open > 0 && <Text><b>{open}</b> still open</Text>}
      </Space>
      <ResolutionRecordsTable records={matching} loading={loading} onOpen={openSR} pageSize={10} searchable />
    </Drawer>
  );
}
