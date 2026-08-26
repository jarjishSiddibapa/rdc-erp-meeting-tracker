import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  message, Switch, Typography, Tooltip, Upload, Alert, Grid
} from 'antd';
import {
  PlusOutlined, EditOutlined, UsergroupAddOutlined,
  DownloadOutlined, FileExcelOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import { Reveal } from '../components/ui/Reveal';
import BrandButton from '../components/ui/BrandButton';
import { paginationConfig, compactPaginationConfig } from '../utils/pagination';

const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const BRAND = '#00B51A';

const ROLE_COLORS = { admin: 'red', editor: 'blue', viewer: 'green' };
const BULK_SHEET_NAME = 'Users';
const BULK_USER_FIELDS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'email',     label: 'Email' },
  { key: 'role',      label: 'Role (admin / editor / viewer)' },
];

// ── Bulk Add Users modal: download a blank template, fill it in Excel, upload it back.
// Every row goes through the same account-provisioning path as a single Add (random temp
// password + welcome email with a reset link) - this is just the batched version of it.
function BulkAddUsersModal({ open, onClose, onDone }) {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleDownload() {
    setDownloading(true);
    try {
      // Same deferred-load reasoning as SRPage.jsx/UpdateTasks.jsx - xlsx only needs to load
      // once someone actually opens this modal and clicks Download.
      const [XLSX, { buildSheet }] = await Promise.all([import('xlsx'), import('../utils/excelIO')]);
      const wb = XLSX.utils.book_new();
      buildSheet(wb, BULK_SHEET_NAME, BULK_USER_FIELDS, []);
      const notes = XLSX.utils.aoa_to_sheet([
        ['How to use this template'],
        ['1. Fill in one row per user on the "Users" sheet - Full Name, Email, Role.'],
        ['2. Email must be a valid @rdc.in address.'],
        ['3. Role must be exactly one of: admin, editor, viewer.'],
        ['4. Save the file and upload it back here.'],
        ['Each user gets a randomly generated temporary password and an email with a link to set their own password - you never need to choose or share a password yourself.'],
      ]);
      notes['!cols'] = [{ wch: 90 }];
      XLSX.utils.book_append_sheet(wb, notes, 'Instructions');
      XLSX.writeFile(wb, `RDC_Bulk_Add_Users_Template.xlsx`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload(file) {
    setUploading(true); setResult(null);
    try {
      const { readWorkbook, readSheetAsFields } = await import('../utils/excelIO');
      const wb = await readWorkbook(file);
      const rows = readSheetAsFields(wb, BULK_SHEET_NAME, BULK_USER_FIELDS);
      if (!rows) {
        setResult({ error: `Couldn't find the "${BULK_SHEET_NAME}" sheet in this file. Download the template first and fill in that file.` });
        return;
      }
      const nonEmpty = rows.filter(r => r.full_name || r.email || r.role);
      if (!nonEmpty.length) {
        setResult({ error: 'No rows found - fill in at least one user below the header row.' });
        return;
      }
      const res = await userAPI.bulkCreate(nonEmpty);
      setResult(res.data);
      if (res.data.created > 0) onDone?.();
    } catch (e) {
      setResult({ error: e.response?.data?.message || 'Could not read that file - make sure it\'s the .xlsx template downloaded from here.' });
    } finally {
      setUploading(false);
    }
    return false; // prevent antd Upload's own upload behavior
  }

  function reset() { setResult(null); }
  function handleClose() { reset(); onClose(); }

  const resultColumns = [
    { title: 'Row', dataIndex: 'row', width: 60 },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: v => <Tag color={v === 'created' ? 'green' : 'red'}>{v === 'created' ? 'Created' : 'Failed'}</Tag>
    },
    { title: 'Details', dataIndex: 'message' },
  ];

  return (
    <Modal
      title={<Space><UsergroupAddOutlined /> Bulk Add Users</Space>}
      open={open}
      onCancel={handleClose}
      footer={<Button onClick={handleClose}>Close</Button>}
      width={720}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Download the template, add one row per user (Full Name, Email, Role), then upload the
        same file back here. Each user is created with a random temporary password and gets a
        welcome email with a link to set their own - the normal account-creation flow, just for
        many people at once.
      </Paragraph>

      {result?.error && <Alert type="error" showIcon message={result.error} style={{ marginBottom: 16 }} />}

      {!result || result.error ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>1. Download the template</Text>
            <br />
            <BrandButton icon={<DownloadOutlined />} loading={downloading} onClick={handleDownload} style={{ marginTop: 8 }}>
              Download Excel Template
            </BrandButton>
          </div>
          <div>
            <Text strong>2. Fill it in, then upload the same file</Text>
            <Dragger accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false} style={{ marginTop: 8 }}>
              <p className="ant-upload-drag-icon"><FileExcelOutlined style={{ fontSize: 36, color: BRAND }} /></p>
              <p className="ant-upload-text">{uploading ? 'Creating users...' : 'Click or drag your filled-in Excel file here'}</p>
              <p className="ant-upload-hint">Must have a "{BULK_SHEET_NAME}" sheet with Full Name, Email, and Role columns.</p>
            </Dragger>
          </div>
        </Space>
      ) : (
        <div>
          <Alert
            type={result.failed > 0 ? 'warning' : 'success'}
            showIcon
            icon={<CheckCircleOutlined />}
            message={`${result.created} user${result.created === 1 ? '' : 's'} created${result.failed ? `, ${result.failed} failed` : ''}`}
            style={{ marginBottom: 16 }}
          />
          <Table
            rowKey="row" size="small" columns={resultColumns} dataSource={result.results}
            pagination={result.results.length > 10 ? compactPaginationConfig('rows', { defaultPageSize: 10 }) : false}
            scroll={{ x: 'max-content' }}
          />
          <Button onClick={reset} style={{ marginTop: 16 }}>Upload Another File</Button>
        </div>
      )}
    </Modal>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await userAPI.list();
      setUsers(res.data);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  function openAdd() {
    setEditingUser(null);
    form.resetFields();
    setFormOpen(true);
  }

  const openEdit = useCallback((u) => {
    setEditingUser(u);
    form.setFieldsValue({
      full_name: u.full_name, email: u.email, role: u.role, is_active: u.is_active === 1,
      can_edit_digitization: u.can_edit_digitization === 1,
    });
    setFormOpen(true);
  }, [form]);

  async function handleSubmit(values) {
    setSubmitting(true);
    try {
      if (editingUser) {
        await userAPI.update(editingUser.id, { ...values, is_active: values.is_active ? 1 : 0 });
        message.success('User updated');
      } else {
        const res = await userAPI.create(values);
        if (res.data.email_sent === false) {
          message.warning('User created, but the welcome email could not be sent - check the SMTP settings and let them know their temporary password directly.');
        } else {
          message.success('User created - a welcome email with their temporary password and a reset link has been sent.');
        }
      }
      setFormOpen(false);
      fetchUsers();
    } catch (e) {
      message.error(e.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Matches the useMemo/useCallback pattern SRPage.jsx and Reports.jsx already use for their
  // column builders - avoids handing the Table a new columns array (and new render closures)
  // on every unrelated re-render.
  const columns = useMemo(() => [
    { title: 'Full Name', dataIndex: 'full_name', render: (v, row) => <>{v}{row.id === currentUser?.id ? <Tag style={{ marginLeft: 8 }}>You</Tag> : ''}</> },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Role', dataIndex: 'role', render: (v, row) => (
        <Space size={4}>
          <Tag color={ROLE_COLORS[v]}>{v.toUpperCase()}</Tag>
          {v === 'viewer' && row.can_edit_digitization === 1 && <Tag color="cyan">CAN EDIT DIGITIZATION</Tag>}
        </Space>
      )
    },
    { title: 'Status', dataIndex: 'is_active', render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Created', dataIndex: 'created_at', render: v => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Actions', render: (_, row) => (
        <Tooltip title="Edit">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        </Tooltip>
      )
    }
  ], [currentUser?.id, openEdit]);

  return (
    <div style={{ width: '100%' }}>
      <Reveal>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0 }}>User Management</Title>
          <Space wrap>
            <Button icon={<UsergroupAddOutlined />} onClick={() => setBulkOpen(true)}>Bulk Add Users</Button>
            <BrandButton icon={<PlusOutlined />} onClick={openAdd}>Add User</BrandButton>
          </Space>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Table
          rowKey="id" columns={columns} dataSource={users} loading={loading} size="small" scroll={{ x: 'max-content' }}
          pagination={paginationConfig('users', { defaultPageSize: 10 })}
        />
      </Reveal>

      <Modal
        title={editingUser ? `Edit User - ${editingUser.full_name}` : 'Add New User'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={isMobile ? '94%' : 520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { pattern: /^[a-zA-Z0-9._%+-]+@rdc\.in$/i, message: 'Must be a valid @rdc.in address' },
            ]}
          >
            <Input type="email" placeholder="name@rdc.in" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="admin">Admin - Full access + user management</Option>
              <Option value="editor">Editor - Add/Update/Close SRs</Option>
              <Option value="viewer">Viewer - Read-only</Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) => getFieldValue('role') === 'viewer' && (
              <Form.Item name="can_edit_digitization" label="Allow editing Digitization Projects" valuePropName="checked">
                <Switch />
              </Form.Item>
            )}
          </Form.Item>
          {!editingUser && (
            <Alert
              type="info" showIcon
              message="No password needed here - a random temporary password will be generated and emailed to them along with a link to set their own."
              style={{ marginBottom: 8 }}
            />
          )}
          {editingUser && (
            <Form.Item name="password" label="Reset Password (leave blank to keep current)">
              <Input.Password />
            </Form.Item>
          )}
          {editingUser && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <BulkAddUsersModal open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={fetchUsers} />
    </div>
  );
}
