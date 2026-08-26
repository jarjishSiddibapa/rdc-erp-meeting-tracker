import { useEffect, useState } from 'react';
import {
  Card, Switch, TimePicker, Button, Table, Tag, Space, Typography,
  message, Popconfirm, Tooltip, Statistic, Row, Col
} from 'antd';
import {
  CloudServerOutlined, PlayCircleOutlined, DownloadOutlined,
  DeleteOutlined, CheckCircleFilled, CloseCircleFilled, SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { backupAPI } from '../services/api';
import { Reveal } from '../components/ui/Reveal';
import TiltCard from '../components/ui/TiltCard';
import BrandButton from '../components/ui/BrandButton';
import { paginationConfig } from '../utils/pagination';

const { Title, Text } = Typography;

function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

const STATUS_TAG = {
  success: <Tag icon={<CheckCircleFilled />} color="success">Success</Tag>,
  failed: <Tag icon={<CloseCircleFilled />} color="error">Failed</Tag>,
  running: <Tag icon={<SyncOutlined spin />} color="processing">Running</Tag>,
};

export default function BackupSettings() {
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([backupAPI.getSettings(), backupAPI.history()]);
      setSettings(s.data);
      setHistory(h.data);
    } catch {
      message.error('Failed to load backup settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await backupAPI.updateSettings(settings);
      setSettings(res.data);
      message.success('Backup schedule saved');
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await backupAPI.runNow();
      message.success(`Backup completed — ${formatBytes(res.data.size)}`);
      fetchAll();
    } catch (e) {
      message.error(e.response?.data?.message || 'Backup failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload(filename) {
    try {
      await backupAPI.download(filename);
    } catch {
      message.error('Download failed');
    }
  }

  async function handleDelete(filename) {
    try {
      await backupAPI.delete(filename);
      message.success('Backup file removed');
      fetchAll();
    } catch {
      message.error('Failed to remove backup');
    }
  }

  const columns = [
    { title: 'File', dataIndex: 'filename', ellipsis: true },
    { title: 'Status', dataIndex: 'status', width: 110, render: v => STATUS_TAG[v] || v },
    { title: 'Size', dataIndex: 'size_bytes', width: 100, render: formatBytes },
    { title: 'Triggered', dataIndex: 'triggered_by', width: 100, render: v => <Tag>{v}</Tag> },
    { title: 'Started', dataIndex: 'started_at', width: 190, render: v => dayjs(v).format('DD-MMM-YYYY hh:mm:ss A') },
    {
      title: 'Actions', width: 110, render: (_, row) => (
        <Space>
          {row.status === 'success' && (
            <Tooltip title="Download">
              <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(row.filename)} />
            </Tooltip>
          )}
          <Popconfirm title="Remove this backup file?" onConfirm={() => handleDelete(row.filename)} okButtonProps={{ danger: true }}>
            <Tooltip title="Delete file">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    },
  ];

  const lastSuccess = history.find(h => h.status === 'success');

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <CloudServerOutlined style={{ fontSize: 20, color: '#00B51A' }} />
        <Title level={5} style={{ margin: 0 }}>Backup Settings</Title>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Reveal>
            <TiltCard style={{ borderRadius: 10 }}>
              <Card size="small" loading={loading} title="Automatic Daily Backup" className="shadow-soft" style={{ borderRadius: 10 }}>
                {settings && (
                  <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Space align="center" size={16}>
                      <Switch
                        checked={!!settings.enabled}
                        onChange={v => setSettings({ ...settings, enabled: v })}
                      />
                      <Text>{settings.enabled ? 'Automatic backups are enabled' : 'Automatic backups are disabled'}</Text>
                    </Space>

                    <Space align="center" size={16} wrap>
                      <Text>Run every day at</Text>
                      <TimePicker
                        value={dayjs().hour(settings.hour).minute(settings.minute)}
                        format="hh:mm A"
                        use12Hours
                        onChange={v => v && setSettings({ ...settings, hour: v.hour(), minute: v.minute() })}
                        disabled={!settings.enabled}
                      />
                    </Space>

                    <BrandButton loading={saving} onClick={handleSave}>Save Schedule</BrandButton>
                  </Space>
                )}
              </Card>
            </TiltCard>
          </Reveal>
        </Col>
        <Col xs={24} lg={8}>
          <Reveal delay={0.06}>
            <TiltCard style={{ height: '100%', borderRadius: 10 }}>
              <Card size="small" style={{ height: '100%', borderRadius: 10 }} className="shadow-soft">
                <Statistic title="Last successful backup"
                  value={lastSuccess ? dayjs(lastSuccess.started_at).fromNow?.() ?? dayjs(lastSuccess.started_at).format('DD-MMM hh:mm A') : 'None yet'}
                />
                <BrandButton variant="ghost" block icon={<PlayCircleOutlined />} loading={running} onClick={handleRunNow} style={{ marginTop: 16 }}>
                  Run Backup Now
                </BrandButton>
              </Card>
            </TiltCard>
          </Reveal>
        </Col>
      </Row>

      <Reveal delay={0.1}>
        <Card size="small" title="Backup History" style={{ marginTop: 16 }}>
          <Table
            rowKey="id" size="small" columns={columns} dataSource={history} loading={loading}
            pagination={paginationConfig('backups', { defaultPageSize: 10 })}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </Reveal>
    </div>
  );
}
