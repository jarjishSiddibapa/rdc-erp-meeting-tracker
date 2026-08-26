import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Typography, Button,
  Spin, Progress, Space, Alert, Tooltip
} from 'antd';
import {
  ClockCircleFilled, PlusCircleFilled,
  WarningFilled, TeamOutlined,
  DatabaseOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { statsAPI } from '../services/api';
import { Reveal, RevealGroup } from '../components/ui/Reveal';
import TiltCard from '../components/ui/TiltCard';
import AnimatedCounter from '../components/ui/AnimatedCounter';

const { Title, Text } = Typography;
const BRAND = '#00B51A';

// A palette anchored in the brand green rather than an unrelated rainbow — one warm
// accent reserved for "needs attention" tiles, everything else a shade of brand green.
const PALETTE = {
  total: '#00B51A',
  pending: '#c2760c',
  overdue: '#cf1322',
  closed: '#0e9f6e',
  added: '#048a17',
  addedThisWeek: '#2e9e5b',
  closedWeek: '#3ecf5c',
};

function StatCard({ title, value, icon, color }) {
  return (
    <TiltCard style={{ height: '100%', borderRadius: 10 }}>
      <Card size="small" style={{ background: color, border: 'none', height: '100%', borderRadius: 10 }} className="shadow-soft">
        <Space style={{ color: '#fff' }}>{icon}<span style={{ fontSize: 12 }}>{title}</span></Space>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>
          <AnimatedCounter value={value ?? 0} />
        </div>
      </Card>
    </TiltCard>
  );
}

function SectionHeader({ icon, title, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
      <div style={{ width: 4, height: 22, borderRadius: 2, background: color }} />
      {icon}
      <Title level={5} style={{ margin: 0, color }}>{title}</Title>
    </div>
  );
}

// Column header + an info icon carrying a plain-English explanation of the calculation, so a
// figure like "Added This Week" doesn't require guessing what date range it covers.
function ColHeader({ label, tooltip, bold }) {
  return (
    <Space size={4}>
      <span style={bold ? { fontWeight: 800 } : undefined}>{label}</span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
      </Tooltip>
    </Space>
  );
}

function PendingTable({ data, loading, category, onNavigate }) {
  const total = data.reduce((s, r) => s + (r.pending_now || 0), 0);
  const cols = [
    {
      title: 'Pending With',
      dataIndex: 'name',
      fixed: 'left',
      width: 160,
      // "(Unassigned)" is clickable too — it means real pending SRs with a blank Pending
      // With field, and someone needs to be able to click through to actually go fill that
      // in, not just see a dead label with no way to act on it.
      render: (v) => (
        <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }}
          onClick={() => onNavigate(category, v)}>
          {v}
        </Button>
      ),
    },
    {
      title: (
        <ColHeader bold label="Pending (Now)"
          tooltip="Open right now, this moment — a live count, not a snapshot. The ▲/▼ shows the change since the 'Pending (Last Week)' snapshot, 7 days ago." />
      ),
      dataIndex: 'pending_now',
      width: 150,
      render: (v, row) => {
        const diff = (v || 0) - (row.last_week_pending || 0);
        return (
          <Space size={4}>
            <Tag color="blue" style={{ fontWeight: 800, fontSize: 13, padding: '1px 10px' }}>{v ?? 0}</Tag>
            {diff > 0 && <Text type="danger" style={{ fontSize: 11 }}>▲ {diff}</Text>}
            {diff < 0 && <Text type="success" style={{ fontSize: 11 }}>▼ {Math.abs(diff)}</Text>}
          </Space>
        );
      },
    },
    {
      title: (
        <ColHeader label="Pending (Last Week)"
          tooltip="A snapshot: how many were still open exactly 7 days ago — the moment this week's rolling window began. Not last week's total activity, just where things stood then." />
      ),
      dataIndex: 'last_week_pending',
      width: 170,
      render: (v) => <Tag color="purple">{v ?? 0}</Tag>,
    },
    {
      title: (
        <ColHeader label="Added (Last Week)"
          tooltip="New SRs raised in the 7 days before that — 8 to 14 days ago. Rolls forward daily, not tied to a fixed calendar week." />
      ),
      dataIndex: 'added_last_week',
      width: 150,
      render: (v) => <Tag color="geekblue">{v ?? 0}</Tag>,
    },
    {
      title: (
        <ColHeader label="Closed (Last Week)"
          tooltip="SRs closed out 8 to 14 days ago." />
      ),
      dataIndex: 'closed_last_week',
      width: 150,
      render: (v) => <Tag color="green">{v ?? 0}</Tag>,
    },
    {
      title: (
        <ColHeader label="Added (This Week)"
          tooltip="New SRs raised in the last 7 days, including today. A rolling window — updates daily, not just once a week." />
      ),
      dataIndex: 'added_this_week',
      width: 150,
      render: (v) => <Tag color="cyan">{v ?? 0}</Tag>,
    },
    {
      title: (
        <ColHeader label="On Hold"
          tooltip="Paused for now — waiting on something before work can continue." />
      ),
      dataIndex: 'on_hold',
      width: 100,
      render: (v) => v > 0 ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: (
        <ColHeader label="Overdue"
          tooltip="Past the expected closure date and still not closed." />
      ),
      dataIndex: 'overdue',
      width: 90,
      render: (v) => v > 0 ? <Tag color="red"><WarningFilled /> {v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: (
        <ColHeader label="Share (Now)"
          tooltip="This person's slice of the total pending workload right now." />
      ),
      dataIndex: 'pending_now',
      width: 130,
      render: (v) => (
        <Progress
          percent={total ? Math.round(((v || 0) / total) * 100) : 0}
          size="small"
          strokeColor={(v || 0) / (total || 1) > 0.5 ? '#ff4d4f' : BRAND}
        />
      ),
    },
  ];
  return (
    <Table
      rowKey="name"
      columns={cols}
      dataSource={data}
      size="small"
      loading={loading}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No pending SRs' }}
    />
  );
}

export default function DashboardHome({ onNavigateToSR }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    statsAPI.dashboard()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message={error} showIcon />;

  const { sr } = data;

  return (
    <div style={{ width: '100%' }}>
        <Reveal>
          <SectionHeader icon={<DatabaseOutlined style={{ color: BRAND }} />} title="Service Requests" color={BRAND} />
        </Reveal>

        <RevealGroup>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}>
            <StatCard title="Total SRs" value={sr.total} icon={<DatabaseOutlined />} color={PALETTE.total} />
            <StatCard title="Pending Now" value={sr.pending_now} icon={<ClockCircleFilled />} color={PALETTE.pending} />
            <StatCard title="Overdue" value={sr.overdue} icon={<WarningFilled />} color={PALETTE.overdue} />
            <StatCard title="Added Last Week" value={sr.added_last_week} icon={<PlusCircleFilled />} color={PALETTE.added} />
            <StatCard title="Added This Week" value={sr.added_this_week} icon={<PlusCircleFilled />} color={PALETTE.addedThisWeek} />
          </div>
        </RevealGroup>

        <Reveal delay={0.1}>
          <Card size="small" style={{ marginTop: 16 }}
            title={<Space><TeamOutlined /><span>Pending SRs by Person</span></Space>}>
            <PendingTable data={sr.by_pending_with} loading={loading} category="SR" onNavigate={onNavigateToSR} />
          </Card>
        </Reveal>
    </div>
  );
}
