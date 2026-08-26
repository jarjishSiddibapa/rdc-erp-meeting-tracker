import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, AutoComplete, DatePicker, Button, Row, Col, Grid } from 'antd';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { srAPI } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

// Status options - Closed is excluded for non-admin in Add/Edit form;
// closure is done via the dedicated Close button (admin only)
const BASE_STATUSES = ['Open', 'In Progress', 'Pending', 'On Hold', 'Pending with User'];
const ALL_STATUSES = [...BASE_STATUSES, 'Closed'];

const SR_TYPES = ['Enhancement', 'Bug Fix', 'Configuration', 'Consultation', 'Development', 'Report', 'Integration', 'Other'];

function dateVal(v) { return v ? dayjs(v) : null; }
function fmtDate(v) { return v ? v.format('YYYY-MM-DD') : null; }

// Suggests values already used elsewhere in the app (for standardization - e.g. "Nagesh"
// instead of a mix of "Nagesh"/"nagesh "/"Nagesh K"), narrowed to matches as you type, but
// never blocks typing something new - antd's AutoComplete does exactly this out of the box.
function useDistinctOptions(category, field, open) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    if (!open) return;
    srAPI.distinctValues(category, field)
      .then(res => setOptions(res.data.map(v => ({ value: v }))))
      .catch(() => setOptions([]));
  }, [category, field, open]);
  return options;
}

function filterOption(inputValue, option) {
  return option.value.toLowerCase().includes(inputValue.toLowerCase());
}

export default function SRForm({ open, onClose, onSubmit, initialValues, category, loading }) {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const isEdit = !!initialValues?.id;
  const isAdmin = user?.role === 'admin';
  const isDigitization = category === 'Digitization';
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;

  const pendingWithOptions = useDistinctOptions(category, 'pendingWith', open);
  const assignedToOptions = useDistinctOptions(category, 'assignedTo', open && !isDigitization);
  const createdByOptions = useDistinctOptions(category, 'createdByName', open && !isDigitization);
  const processOwnerOptions = useDistinctOptions(category, 'processOwner', open && isDigitization);

  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        creation_date: dateVal(initialValues.creation_date),
        expected_closure_date: dateVal(initialValues.expected_closure_date),
        target_date: dateVal(initialValues.target_date),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ category, status: 'Open', creation_date: dayjs() });
    }
  }, [open, initialValues, category]);

  async function handleFinish(values) {
    const data = {
      ...values,
      creation_date: fmtDate(values.creation_date),
      expected_closure_date: fmtDate(values.expected_closure_date),
      target_date: fmtDate(values.target_date),
    };
    await onSubmit(data);
  }

  const statusOptions = isAdmin ? ALL_STATUSES : BASE_STATUSES;

  return (
    <Modal
      title={isEdit ? `Edit SR - ${initialValues?.sr_number}` : `Add New ${isDigitization ? 'Project' : 'SR'}`}
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>Cancel</Button>
          <Button type="primary" loading={loading} onClick={() => form.submit()}>
            {isEdit ? 'Save Changes' : `Add ${isDigitization ? 'Project' : 'SR'}`}
          </Button>
        </div>
      }
      width={isMobile ? '96%' : 680}
      style={isMobile ? undefined : { top: 20 }}
      styles={{
        // Same fix as SRDetail: cap the body relative to the real viewport so the footer
        // (Cancel/Save) never gets pushed below the fold on shorter browser windows -
        // only the field list scrolls, the buttons stay put.
        body: { maxHeight: isMobile ? 'calc(100vh - 180px)' : 'calc(100vh - 220px)', overflowY: 'auto' },
      }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 16 }}>
        {/* Not user-editable - just needs to be a registered field so its value (set via
            setFieldsValue below) actually ends up in the submitted values. */}
        <Form.Item name="category" hidden>
          <Input type="hidden" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="sr_number" label="SR / Project No." rules={[{ required: true, message: 'SR number is required' }]}>
              <Input placeholder="e.g. SR-2024-001" disabled={isEdit} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select>
                {statusOptions.map(s => <Option key={s} value={s}>{s}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* ── SR fields ── */}
        {!isDigitization && (
          <>
            <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
              <TextArea rows={3} placeholder="Brief description of the SR" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="scope" label="Internal / External" rules={[{ required: true, message: 'Please select Internal or External' }]}>
                  <Select placeholder="Select scope">
                    <Option value="Internal">Internal</Option>
                    <Option value="External">External</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="type" label="Type">
                  <Select allowClear placeholder="Select type">
                    {SR_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="created_by_name" label="Created By">
                  <AutoComplete
                    options={createdByOptions}
                    filterOption={filterOption}
                    placeholder="Name of person who raised the SR"
                  />
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
                <Form.Item name="pending_with" label="Pending With">
                  <AutoComplete
                    options={pendingWithOptions}
                    filterOption={filterOption}
                    placeholder="Team or person it's pending with"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="assigned_to" label="Assigned To">
                  <AutoComplete
                    options={assignedToOptions}
                    filterOption={filterOption}
                    placeholder="Vendor or team the SR is assigned to"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="expected_closure_date" label="Expected Closure Date">
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {/* ── Digitization fields ── */}
        {isDigitization && (
          <>
            <Form.Item name="project_name" label="Project Name" rules={[{ required: true, message: 'Project Name is required' }]}>
              <Input placeholder="Name of the digitization project" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="process_owner" label="Process Owner">
                  <AutoComplete
                    options={processOwnerOptions}
                    filterOption={filterOption}
                    placeholder="Owner of the process / department"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="pending_with" label="Pending With">
                  <AutoComplete
                    options={pendingWithOptions}
                    filterOption={filterOption}
                    placeholder="Team or person it's pending with"
                  />
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
    </Modal>
  );
}
