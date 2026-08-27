import { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Typography, Button,
  Spin, Progress, Space, Alert, Tooltip
} from 'antd';
import {
  CheckCircleFilled, ClockCircleFilled, PlusCircleFilled,
  WarningFilled, TeamOutlined,
  DatabaseOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { statsAPI } from '../services/api';
import { Reveal, RevealGroup } from '../components/ui/Reveal';
import TiltCard from '../components/ui/TiltCard';
import AnimatedCounter from '../components/ui/AnimatedCounter';

const { Title, Text } = Typography;
const BRAND = '#00B51A';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A palette anchored in the brand green rather than an unrelated rainbow. One warm
// accent reserved for "needs attention" tiles, everything else a shade of brand green.
const PALETTE = {
  total: '#00B51A',
  pending: '#c2760c',
  overdue: '#cf1322',
  added: '#048a17',
  closedWeek: '#3ecf5c',
};

function StatCard({ title, value, icon, color, formula }) {
  return (
    <TiltCard style={{ height: '100%', borderRadius: 10 }}>
      <Card size="small" style={{ background: color, border: 'none', height: '100%', borderRadius: 10 }} className="shadow-soft">
        <Space style={{ color: '#fff' }}>
          {icon}<span style={{ fontSize: 12 }}>{title}</span>
          {formula && (
            <Tooltip title={<>Formula: {formula}</>}>
              <InfoCircleOutlined style={{ color: 'rgba(255,255,255,.88)', fontSize: 12 }} />
            </Tooltip>
          )}
        </Space>
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

// Column header + an info icon carrying the exact formula, so a figure never requires
// guessing what it counts. "Today" always means the date the dashboard is loaded.
function ColHeader({ label, formula, bold }) {
  return (
    <Space size={4}>
      <span style={bold ? { fontWeight: 800 } : undefined}>{label}</span>
      <Tooltip title={<>Formula: {formula}</>}>
        <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
      </Tooltip>
    </Space>
  );
}

function ComparisonStrip({ periods, sr }) {
  if (!periods?.current?.start || !periods?.previous?.start) return null;
  const formatDate = (value) => {
    const [, month, day] = value.split('-').map(Number);
    return `${day} ${MONTHS[month - 1]}`;
  };
  const label = (period) => `${formatDate(period.start)} - ${formatDate(period.end)}`;

  const Metric = ({ name, previousLabel, previous, currentLabel, current }) => (
    <div style={{ minWidth: 0 }}>
      <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{name}</Text>
      <Space size={7} align="baseline" wrap>
        <span style={{ whiteSpace: 'nowrap' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{previousLabel}</Text>{' '}
          <Text strong style={{ fontSize: 17 }}>{Number(previous) || 0}</Text>
        </span>
        <Text type="secondary">→</Text>
        <span style={{ whiteSpace: 'nowrap' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{currentLabel}</Text>{' '}
          <Text strong style={{ fontSize: 17, color: BRAND }}>{Number(current) || 0}</Text>
        </span>
      </Space>
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      gap: 12,
      alignItems: 'center',
      marginTop: 12,
      padding: '10px 12px',
      border: '1px solid #e5e7e6',
      borderRadius: 9,
      background: '#fbfcfb',
    }}>
      <div>
        <Space size={5}>
          <Text strong>7-day comparison</Text>
          <Tooltip title="Pending compares the open workload at the start of the current period with now. Added and Closed compare the previous 7 days with the current 7 days.">
            <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          </Tooltip>
        </Space>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, whiteSpace: 'nowrap' }}>
          {label(periods.previous)} → {label(periods.current)}
        </Text>
      </div>
      <Metric name="Pending workload" previousLabel="Start" previous={sr.pending_at_period_start}
        currentLabel="Now" current={sr.pending_now} />
      <Metric name="SRs added" previousLabel="Previous" previous={sr.added_previous_7d}
        currentLabel="Current" current={sr.added_current_7d} />
      <Metric name="SRs closed" previousLabel="Previous" previous={sr.closed_previous_7d}
        currentLabel="Current" current={sr.closed_current_7d} />
    </div>
  );
}

function PendingTable({ data, loading, category, onNavigate }) {
  const total = useMemo(() => data.reduce((sum, row) => sum + (Number(row.pending_now) || 0), 0), [data]);
  const cols = useMemo(() => [
    {
      title: 'Pending With',
      dataIndex: 'name',
      fixed: 'left',
      width: 160,
      // "(Unassigned)" is clickable too. It means real pending SRs with a blank Pending
      // With field, and someone needs to be able to click through to actually go fill that
      // in, not just see a dead label with no way to act on it.
      render: (value, row) => Number(row.pending_now) > 0 ? (
        <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }}
          onClick={() => onNavigate(category, value)}>
          {value}
        </Button>
      ) : <Text strong>{value}</Text>,
    },
    {
      title: (
        <ColHeader bold label="Pending Now"
          formula="Status is not Closed. Grouped by the current Pending With value." />
      ),
      dataIndex: 'pending_now',
      width: 120,
      render: (value) => <Tag color="blue" style={{ fontWeight: 800 }}>{value}</Tag>,
    },
    {
      title: (
        <ColHeader label="On Hold"
          formula="Status = On Hold. This is already included in Pending Now." />
      ),
      dataIndex: 'on_hold',
      width: 100,
      render: (v) => v > 0 ? <Tag color="purple">{v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: (
        <ColHeader label="Overdue"
          formula="Status is not Closed AND Expected Closure Date is before today." />
      ),
      dataIndex: 'overdue',
      width: 90,
      render: (v) => v > 0 ? <Tag color="red"><WarningFilled /> {v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: (
        <ColHeader label="Added (7d)"
          formula="Creation Date is in the current 7-day period. Created At is used only when Creation Date is blank. Grouped by current Pending With." />
      ),
      dataIndex: 'added_current_7d',
      width: 110,
      render: (value) => value > 0 ? <Tag color="cyan">{value}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: (
        <ColHeader label="Closed (7d)"
          formula="Status is Closed and Closed Date is in the current 7-day period. Grouped by current Pending With." />
      ),
      dataIndex: 'closed_current_7d',
      width: 110,
      render: (value) => value > 0 ? <Tag color="green">{value}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: (
        <ColHeader label="Share"
          formula="This person's Pending Now ÷ everyone's Pending Now, as a percentage." />
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
  ], [category, onNavigate, total]);
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

  const { sr, periods } = data;
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
            <StatCard title="Total SRs" value={sr.total} icon={<DatabaseOutlined />} color={PALETTE.total}
              formula="All non-deleted Service Requests, including open and closed records." />
            <StatCard title="Pending Now" value={sr.pending_now} icon={<ClockCircleFilled />} color={PALETTE.pending}
              formula="Status is not Closed." />
            <StatCard title="Overdue Now" value={sr.overdue} icon={<WarningFilled />} color={PALETTE.overdue}
              formula="Status is not Closed and Expected Closure Date is before today." />
            <StatCard title="Added (7 Days)" value={sr.added_current_7d} icon={<PlusCircleFilled />} color={PALETTE.added}
              formula="Creation Date is in the current 7-day period. Created At is used when Creation Date is blank." />
            <StatCard title="Closed (7 Days)" value={sr.closed_current_7d} icon={<CheckCircleFilled />} color={PALETTE.closedWeek}
              formula="Status is Closed and Closed Date is in the current 7-day period." />
          </div>
        </RevealGroup>

        <Reveal delay={0.05}>
          <ComparisonStrip periods={periods} sr={sr} />
        </Reveal>

        <Reveal delay={0.1}>
          <Card size="small" style={{ marginTop: 12 }}
            title={<Space><TeamOutlined /><span>Current SR workload by Pending With</span></Space>}>
            <PendingTable data={sr.by_pending_with} loading={loading} category="SR" onNavigate={onNavigateToSR} />
          </Card>
        </Reveal>
    </div>
  );
}
