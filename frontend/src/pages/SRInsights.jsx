import { Tabs, Typography } from 'antd';
import { Reveal } from '../components/ui/Reveal';
import AssignedToAnalytics from './ResolutionInsights';
import PendingWithInsights from '../components/PendingWithInsights';

const { Title } = Typography;

// Admin-only analytics on how long SRs take: with the ManageEngine technician they are assigned to, and with the
// person they are pending with. Each tab keeps its own filters while the other is open.
export default function SRInsights() {
  const items = [
    { key: 'assigned', label: 'Assigned to Analytics', children: <AssignedToAnalytics /> },
    { key: 'pending', label: 'Pending with Insights', children: <PendingWithInsights /> },
  ];
  return (
    <Reveal>
      <div style={{ width: '100%' }}>
        <Title level={5} style={{ marginBottom: 4 }}>SR Insights</Title>
        <Tabs defaultActiveKey="assigned" items={items} />
      </div>
    </Reveal>
  );
}
