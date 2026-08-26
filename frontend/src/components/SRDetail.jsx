import { useState, useEffect, useRef } from 'react';
import {
  Modal, Descriptions, Tag, Timeline, Typography, Divider,
  Input, Button, Space, Avatar, message, Empty, Popconfirm,
  Form, Select, AutoComplete, DatePicker, Row, Col, Badge, Grid
} from 'antd';
import {
  SendOutlined, UserOutlined, HistoryOutlined, CommentOutlined,
  EditOutlined, StopOutlined, DeleteOutlined, SaveOutlined, CloseOutlined,
  UndoOutlined, CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { srAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_COLORS = {
  'Open': 'blue', 'In Progress': 'orange', 'Pending': 'gold',
  'On Hold': 'purple', 'Pending with User': 'magenta', 'Closed': 'green'
};
const SCOPE_COLORS = { 'Internal': 'blue', 'External': 'magenta' };
const BASE_STATUSES = ['Open', 'In Progress', 'Pending', 'On Hold', 'Pending with User'];
const ALL_STATUSES  = [...BASE_STATUSES, 'Closed'];
const SR_TYPES = ['Enhancement', 'Bug Fix', 'Configuration', 'Consultation', 'Development', 'Report', 'Integration', 'Other'];

function fmt(date)   { return date ? dayjs(date).format('DD-MMM-YYYY') : '-'; }
function fmtDT(dt)   { return dt   ? dayjs(dt).format('DD-MMM-YYYY hh:mm A') : '-'; }
function toDay(v)    { return v ? dayjs(v) : null; }
function fromDay(v)  { return v ? v.format('YYYY-MM-DD') : null; }

function filterOption(inputValue, option) {
  return option.value.toLowerCase().includes(inputValue.toLowerCase());
}

export default function SRDetail({ sr: initialSR, open, onClose, onUpdated, onCloseSR, onReopenSR, onDelete }) {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'admin';
  // A viewer flagged can_edit_digitization by an admin may edit/comment on Digitization
  // Projects specifically - Service Requests stay read-only for them either way.
  const canEdit   = isAdmin || user?.role === 'editor'
    || (user?.role === 'viewer' && !!user?.can_edit_digitization && initialSR?.category === 'Digitization');
  const canComment = canEdit;

  const [sr, setSR]         = useState(initialSR);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting]  = useState(false);
  const commentsEndRef = useRef(null);
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;

  // Suggests values already used elsewhere in the app, but never blocks typing something
  // new - same standardization idea as the Add form's autocomplete fields.
  const [pendingWithOptions, setPendingWithOptions] = useState([]);
  const [assignedToOptions, setAssignedToOptions] = useState([]);
  const [createdByOptions, setCreatedByOptions] = useState([]);
  const [processOwnerOptions, setProcessOwnerOptions] = useState([]);

  useEffect(() => {
    setSR(initialSR);
    setEditMode(false);
    setNewComment('');
  }, [initialSR]);

  useEffect(() => {
    if (!editMode || !sr) return;
    const isDig = sr.category === 'Digitization';
    srAPI.distinctValues(sr.category, 'pendingWith').then(res => setPendingWithOptions(res.data.map(v => ({ value: v })))).catch(() => {});
    if (!isDig) {
      srAPI.distinctValues(sr.category, 'assignedTo').then(res => setAssignedToOptions(res.data.map(v => ({ value: v })))).catch(() => {});
    }
    if (isDig) {
      srAPI.distinctValues(sr.category, 'processOwner').then(res => setProcessOwnerOptions(res.data.map(v => ({ value: v })))).catch(() => {});
    } else {
      srAPI.distinctValues(sr.category, 'createdByName').then(res => setCreatedByOptions(res.data.map(v => ({ value: v })))).catch(() => {});
    }
  }, [editMode, sr?.category]);

  useEffect(() => {
    if (editMode && sr) {
      form.setFieldsValue({
        description:           sr.description || '',
        type:                  sr.type || undefined,
        scope:                 sr.scope || undefined,
        creation_date:         toDay(sr.creation_date),
        status:                sr.status,
        created_by_name:       sr.created_by_name || '',
        pending_with:          sr.pending_with || '',
        assigned_to:           sr.assigned_to || '',
        expected_closure_date: toDay(sr.expected_closure_date),
        project_name:          sr.project_name || '',
        process_owner:         sr.process_owner || '',
        target_date:           toDay(sr.target_date),
      });
    }
  }, [editMode, sr]);

  if (!sr) return null;
  const isDigitization = sr.category === 'Digitization';

  /* ── Save edits ── */
  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        creation_date:         fromDay(values.creation_date),
        expected_closure_date: fromDay(values.expected_closure_date),
        target_date:           fromDay(values.target_date),
      };
      // Only admin can set Closed via edit form
      if (payload.status === 'Closed' && !isAdmin) {
        payload.status = sr.status;
      }
      await srAPI.update(sr.id, payload);
      // Re-fetch the full record rather than merging the update response into local state -
      // that response only carries the SR's own columns, not `history`/`comments`, so a
      // naive merge would keep showing the pre-edit history (the exact bug where the
      // closure-date timeline said "never changed" right after changing it).
      const res = await srAPI.get(sr.id);
      setSR(res.data);
      if (onUpdated) onUpdated(res.data);
      setEditMode(false);
      message.success('SR updated successfully');
    } catch (e) {
      if (e?.errorFields) return; // validation error - stay in edit mode
      message.error(e.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  /* ── Add comment ── */
  async function handleAddComment() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await srAPI.addComment(sr.id, newComment.trim());
      const updated = { ...sr, comments: [res.data, ...(sr.comments || [])] };
      setSR(updated);
      setNewComment('');
      if (onUpdated) onUpdated(updated);
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed to add comment');
    } finally { setSubmitting(false); }
  }

  const historyItems = (sr.history || []).map(h => ({
    dot: <HistoryOutlined style={{ fontSize: 12 }} />,
    color: 'gray',
    children: (
      <div style={{ fontSize: 12 }}>
        <Text strong style={{ textTransform: 'capitalize' }}>{h.field_changed.replace(/_/g, ' ')}: </Text>
        <Text delete type="secondary">{h.old_value || '(empty)'}</Text>
        {' → '}
        <Text type="success">{h.new_value || '(empty)'}</Text><br />
        <Text type="secondary">{h.changed_by_name} · {fmtDT(h.changed_at)}</Text>
      </div>
    )
  }));

  // Digitization tracks this date as "target_date" instead of "expected_closure_date" -
  // a dedicated, filtered view of just this field's history, newest first, since it's the
  // one field that tends to get pushed back repeatedly and people want to see the full
  // trail of who moved it and from what to what.
  const closureDateField = isDigitization ? 'target_date' : 'expected_closure_date';
  const closureDateChanges = (sr.history || [])
    .filter(h => h.field_changed === closureDateField)
    .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
  const closureTimelineItems = closureDateChanges.map((h, i) => ({
    dot: <CalendarOutlined style={{ fontSize: 12 }} />,
    color: i === 0 ? 'blue' : 'gray',
    children: (
      <div style={{ fontSize: 12 }}>
        <Text delete type="secondary">{h.old_value ? fmt(h.old_value) : '(not set)'}</Text>
        {' → '}
        <Text type={i === 0 ? 'success' : undefined} strong={i === 0}>{h.new_value ? fmt(h.new_value) : '(cleared)'}</Text><br />
        <Text type="secondary">{h.changed_by_name} · {fmtDT(h.changed_at)}</Text>
      </div>
    )
  }));

  /* ── Footer ── */
  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
      <Space wrap>
        {isAdmin && sr.status !== 'Closed' && !editMode && (
          <Popconfirm
            title="Close this SR?" description="Only admin can reopen it after closing."
            onConfirm={async () => { await onCloseSR?.(sr); onClose(); }}
            okText="Close SR" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<StopOutlined />}>Close SR</Button>
          </Popconfirm>
        )}
        {isAdmin && sr.status === 'Closed' && !editMode && (
          <Popconfirm
            title="Reopen this SR?" description="Status will be set back to Open."
            onConfirm={async () => { await onReopenSR?.(sr); onClose(); }}
            okText="Reopen SR"
          >
            <Button icon={<UndoOutlined />}>Reopen SR</Button>
          </Popconfirm>
        )}
        {isAdmin && !editMode && (
          <Popconfirm
            title="Permanently delete this SR?" description="This action cannot be undone."
            onConfirm={async () => { await onDelete?.(sr.id); onClose(); }}
            okText="Delete" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        )}
      </Space>
      <Space wrap>
        {canEdit && !editMode && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditMode(true)}>
            Edit Details
          </Button>
        )}
        {editMode && (
          <>
            <Button icon={<CloseOutlined />} onClick={() => setEditMode(false)}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </>
        )}
        <Button onClick={onClose}>Close</Button>
      </Space>
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <Tag color={STATUS_COLORS[sr.status]}>{sr.status}</Tag>
          <Text strong>{sr.sr_number}</Text>
          <Text type="secondary" style={{ fontWeight: 400 }}>
            - {isDigitization
              ? sr.project_name
              : (sr.description?.slice(0, 55) + (sr.description?.length > 55 ? '…' : ''))}
          </Text>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={footer}
      width={isMobile ? '96%' : 800}
      style={isMobile ? undefined : { top: 20 }}
      styles={{
        // Capped relative to the actual viewport (not a flat vh guess) so the title
        // and footer always stay on-screen - only the body scrolls internally,
        // no matter how short the browser window is.
        body: { maxHeight: isMobile ? 'calc(100vh - 180px)' : 'calc(100vh - 220px)', overflowY: 'auto', paddingBottom: 8 },
      }}
    >
      {/* ── VIEW MODE ── */}
      {!editMode && (
        <Descriptions bordered column={isMobile ? 1 : 2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="SR Number">{sr.sr_number}</Descriptions.Item>
          <Descriptions.Item label="Category"><Tag>{sr.category}</Tag></Descriptions.Item>
          <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[sr.status]}>{sr.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="Pending With">{sr.pending_with || '-'}</Descriptions.Item>

          {!isDigitization && (
            <>
              <Descriptions.Item label="Internal/External">
                {sr.scope ? <Tag color={SCOPE_COLORS[sr.scope]}>{sr.scope}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Type">{sr.type || '-'}</Descriptions.Item>
              <Descriptions.Item label="Created By">{sr.created_by_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Assigned To">{sr.assigned_to || '-'}</Descriptions.Item>
              <Descriptions.Item label="Creation Date">{fmt(sr.creation_date)}</Descriptions.Item>
              <Descriptions.Item label="Expected Closure">{fmt(sr.expected_closure_date)}</Descriptions.Item>
              {sr.closed_date && <Descriptions.Item label="Closed On" span={2}>{fmt(sr.closed_date)}</Descriptions.Item>}
              <Descriptions.Item label="Description" span={2}>
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{sr.description || '-'}</Paragraph>
              </Descriptions.Item>
            </>
          )}

          {isDigitization && (
            <>
              <Descriptions.Item label="Project Name" span={2}>{sr.project_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Process Owner">{sr.process_owner || '-'}</Descriptions.Item>
              <Descriptions.Item label="Creation Date">{fmt(sr.creation_date)}</Descriptions.Item>
              <Descriptions.Item label="Target Date">{fmt(sr.target_date)}</Descriptions.Item>
              {sr.closed_date && <Descriptions.Item label="Closed On" span={2}>{fmt(sr.closed_date)}</Descriptions.Item>}
            </>
          )}

          <Descriptions.Item label="Added By" span={2}>
            <Text type="secondary">{sr.added_by_name || '-'} · {fmtDT(sr.created_at)}</Text>
          </Descriptions.Item>
        </Descriptions>
      )}

      {/* ── EDIT MODE ── */}
      {editMode && (
        <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select>
                  {(isAdmin ? ALL_STATUSES : BASE_STATUSES).map(s => (
                    <Option key={s} value={s}>{s}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="pending_with" label="Pending With">
                <AutoComplete options={pendingWithOptions} filterOption={filterOption} />
              </Form.Item>
            </Col>
          </Row>

          {!isDigitization && (
            <>
              <Form.Item name="description" label="Description" rules={[{ required: true }]}>
                <TextArea rows={3} />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="scope" label="Internal / External" rules={[{ required: true, message: 'Please select Internal or External' }]}>
                    <Select>
                      <Option value="Internal">Internal</Option>
                      <Option value="External">External</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="type" label="Type">
                    <Select allowClear>
                      {SR_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="created_by_name" label="Created By">
                    <AutoComplete options={createdByOptions} filterOption={filterOption} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="creation_date" label="Creation Date">
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="expected_closure_date" label="Expected Closure Date">
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="assigned_to" label="Assigned To">
                <AutoComplete options={assignedToOptions} filterOption={filterOption} />
              </Form.Item>
            </>
          )}

          {isDigitization && (
            <>
              <Form.Item name="project_name" label="Project Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="process_owner" label="Process Owner">
                    <AutoComplete options={processOwnerOptions} filterOption={filterOption} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="pending_with" label="Pending With">
                    <AutoComplete options={pendingWithOptions} filterOption={filterOption} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="creation_date" label="Creation Date">
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="target_date" label="Target Date">
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Form>
      )}

      {/* ── Comments ── */}
      <Divider orientation="left" style={{ margin: '12px 0' }}>
        <Space><CommentOutlined /> Comments ({(sr.comments || []).length})</Space>
      </Divider>

      <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
        <div ref={commentsEndRef} />
        {(sr.comments || []).length === 0
          ? <Empty description="No comments yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '12px 0' }} />
          : (sr.comments || []).map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ flexShrink: 0, marginTop: 2, background: '#00B51A' }} />
              <div style={{ flex: 1 }}>
                <Space size={8} style={{ marginBottom: 2 }}>
                  <Text strong style={{ fontSize: 13 }}>{c.commenter_name || 'Unknown'}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{fmtDT(c.commented_at)}</Text>
                </Space>
                <div style={{
                  background: '#f5f5f5', borderRadius: 6, padding: '6px 10px',
                  fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {c.comment}
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {canComment && (
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment or update... (Ctrl+Enter to submit)"
            autoSize={{ minRows: 2, maxRows: 4 }}
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleAddComment(); }}
            style={{ borderRadius: '6px 0 0 6px' }}
          />
          <Button
            type="primary" icon={<SendOutlined />} loading={submitting}
            onClick={handleAddComment} disabled={!newComment.trim()}
            style={{ height: 'auto', borderRadius: '0 6px 6px 0', alignSelf: 'flex-end' }}
          >
            Add
          </Button>
        </Space.Compact>
      )}

      {/* ── Expected Closure / Target Date trail ── */}
      <Divider orientation="left" style={{ margin: '16px 0 12px' }}>
        <Space>
          <CalendarOutlined />
          {isDigitization ? 'Target Date' : 'Expected Closure Date'} History
          <Badge count={closureDateChanges.length} showZero color={closureDateChanges.length ? '#00B51A' : '#d9d9d9'} />
        </Space>
      </Divider>
      {closureTimelineItems.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Never changed since it was set to {fmt(sr[closureDateField])}.
        </Text>
      ) : (
        <Timeline items={closureTimelineItems} />
      )}

      {/* ── Change History ── */}
      {historyItems.length > 0 && (
        <>
          <Divider orientation="left" style={{ margin: '16px 0 12px' }}>
            <Space><HistoryOutlined /> Field Change History</Space>
          </Divider>
          <Timeline items={historyItems} />
        </>
      )}
    </Modal>
  );
}
