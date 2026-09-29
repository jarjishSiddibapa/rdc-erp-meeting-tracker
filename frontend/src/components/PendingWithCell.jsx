import { useState, useEffect, useRef } from 'react';
import { Popover, Timeline, Spin, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { srAPI } from '../services/api';

const { Text } = Typography;
function fmtDT(d) { return d ? dayjs(d).format('DD-MMM-YYYY hh:mm A') : '-'; }
function displayNames(v) { return v ? v.split(',').map(s => s.trim()).filter(Boolean).join(', ') : '—'; }

// Same click-to-see-full-history pattern as ClosureDateCell/CommentCell: the cell itself only
// ever shows who it's currently pending with, click it to see the full hand-off trail.
export default function PendingWithCell({ srId, value }) {
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
          .filter(h => h.field_changed === 'pending_with')
          .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
        setChanges(filtered);
      } catch {
        setChanges([]);
      } finally {
        setLoading(false);
      }
    }
  }

  if (!value) return <Text type="secondary">—</Text>;

  const content = (
    <div style={{ maxWidth: 300, minWidth: 220 }}>
      {loading ? (
        <Spin size="small" />
      ) : !changes || changes.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>Never changed since it was set to {displayNames(value)}.</Text>
      ) : (
        <Timeline
          items={changes.map((h, i) => ({
            color: i === 0 ? 'blue' : 'gray',
            children: (
              <div style={{ fontSize: 12 }}>
                <Text delete type="secondary">{h.old_value ? displayNames(h.old_value) : '(empty)'}</Text>
                {' → '}
                <Text type={i === 0 ? 'success' : undefined} strong={i === 0}>{h.new_value ? displayNames(h.new_value) : '(empty)'}</Text><br />
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
      title={<Text strong><UserOutlined /> Pending With History</Text>}
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Text style={{ cursor: 'pointer', borderBottom: '1px dotted currentColor' }}>
        {displayNames(value)}
      </Text>
    </Popover>
  );
}
