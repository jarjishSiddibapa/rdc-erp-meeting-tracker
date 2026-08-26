import { useState, useEffect, useRef } from 'react';
import { Popover, Timeline, Spin, Typography } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { srAPI } from '../services/api';

const { Text } = Typography;
function fmt(d) { return d ? dayjs(d).format('DD-MMM-YYYY') : '-'; }
function fmtDT(d) { return d ? dayjs(d).format('DD-MMM-YYYY hh:mm A') : '-'; }

// The date cell in the table itself is clickable - no need to open the full SR detail
// popup just to see who last pushed a deadline back. History is fetched on first click
// and cached in this component's own state so reopening the same row's popover doesn't
// hit the API again - but that cache is invalidated whenever `value` itself changes
// (i.e. the SR was just edited), otherwise a save wouldn't show up here until the whole
// page reloaded and remounted the cell fresh.
export default function ClosureDateCell({ srId, field, value, warnOverdue, status }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState(null); // null = not fetched yet
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      setChanges(null);
    }
  }, [value]);

  async function handleOpenChange(next) {
    setOpen(next);
    if (next && changes === null) {
      setLoading(true);
      try {
        const res = await srAPI.get(srId);
        const filtered = (res.data.history || [])
          .filter(h => h.field_changed === field)
          .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
        setChanges(filtered);
      } catch {
        setChanges([]);
      } finally {
        setLoading(false);
      }
    }
  }

  if (!value) return <Text type="secondary">-</Text>;
  const overdue = warnOverdue && status !== 'Closed' && dayjs(value).isBefore(dayjs(), 'day');
  const label = field === 'target_date' ? 'Target Date' : 'Expected Closure Date';

  const content = (
    <div style={{ maxWidth: 280, minWidth: 220 }}>
      {loading ? (
        <Spin size="small" />
      ) : !changes || changes.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>Never changed since it was set to {fmt(value)}.</Text>
      ) : (
        <Timeline
          items={changes.map((h, i) => ({
            color: i === 0 ? 'blue' : 'gray',
            children: (
              <div style={{ fontSize: 12 }}>
                <Text delete type="secondary">{h.old_value ? fmt(h.old_value) : '(not set)'}</Text>
                {' → '}
                <Text type={i === 0 ? 'success' : undefined} strong={i === 0}>{h.new_value ? fmt(h.new_value) : '(cleared)'}</Text><br />
                <Text type="secondary">{h.changed_by_name} · {fmtDT(h.changed_at)}</Text>
              </div>
            ),
          }))}
        />
      )}
    </div>
  );

  return (
    <Popover
      title={<Text strong><CalendarOutlined /> {label} History</Text>}
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Text
        type={overdue ? 'danger' : undefined}
        style={{ cursor: 'pointer', borderBottom: '1px dotted currentColor' }}
      >
        {fmt(value)}
      </Text>
    </Popover>
  );
}
