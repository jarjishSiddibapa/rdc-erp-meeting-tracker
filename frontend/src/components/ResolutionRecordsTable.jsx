import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Table, Tag, Button, Typography, Tooltip } from 'antd';
import { formatDuration, toDays, compareNullable } from '../utils/duration';
import { paginationConfig } from '../utils/pagination';
import TableSearch from './ui/TableSearch';
import { matchesSearch, filtersFrom } from '../utils/tableTools';

const { Text } = Typography;

export const STATUS_COLORS = {
  'Open': 'blue', 'In Progress': 'orange', 'Pending': 'gold',
  'On Hold': 'purple', 'Pending with User': 'magenta', 'Closed': 'green',
};

const dt = v => (v ? dayjs(v).format('DD-MMM-YYYY hh:mm A') : '-');
const day = v => (v ? dayjs(v).format('DD-MMM-YYYY') : '-');

// Flat rows for an Excel export of the same records, with turnaround as decimal days.
export function recordsToSheet(records) {
  return records.map(r => ({
    'SR No': r.sr_number,
    Description: r.description || '',
    Technician: r.technician,
    'Internal/External': r.scope || '',
    Type: r.type || '',
    Status: r.status,
    'Raised (ManageEngine)': r.created_at ? dayjs(r.created_at).format('DD-MMM-YYYY hh:mm A') : '',
    'Closed (ManageEngine)': r.closed_at ? dayjs(r.closed_at).format('DD-MMM-YYYY hh:mm A') : '',
    'Turnaround (days)': toDays(r.tat_minutes) ?? '',
    'Turnaround': r.tat_minutes === null ? '' : formatDuration(r.tat_minutes),
    'Open for (days)': toDays(r.age_minutes) ?? '',
    'Expected closure': r.expected_closure_date ? dayjs(r.expected_closure_date).format('DD-MMM-YYYY') : '',
    Overdue: r.overdue ? 'Yes' : '',
    'Time precision': r.exact ? 'Exact' : 'Date only',
  }));
}

// The individual SRs behind the figures. Clicking a number opens the normal SR detail panel.
export default function ResolutionRecordsTable({ records, loading, onOpen, showTechnician = true, pageSize = 20, searchable = false }) {
  const [search, setSearch] = useState('');
  const rows = useMemo(
    () => (searchable ? records.filter(r => matchesSearch(search, r.sr_number, r.description, r.technician, r.type, r.status)) : records),
    [records, search, searchable],
  );
  const technicianFilters = useMemo(() => filtersFrom(records, 'technician'), [records]);
  const typeFilters = useMemo(() => filtersFrom(records, 'type'), [records]);

  const columns = useMemo(() => [
    {
      title: 'SR No', dataIndex: 'sr_number', width: 100, fixed: 'left',
      sorter: (a, b) => Number(a.sr_number) - Number(b.sr_number),
      render: (v, row) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(row.id)}>{v}</Button>
      ),
    },
    { title: 'Description', dataIndex: 'description', width: 260, ellipsis: true, render: v => v || <Text type="secondary">-</Text> },
    ...(showTechnician ? [{
      title: 'Technician', dataIndex: 'technician', width: 160,
      sorter: (a, b) => a.technician.localeCompare(b.technician),
      filters: technicianFilters, filterSearch: true, onFilter: (value, row) => row.technician === value,
    }] : []),
    {
      title: 'Type', dataIndex: 'type', width: 130, ellipsis: true, render: v => v || <Text type="secondary">-</Text>,
      sorter: (a, b) => String(a.type || '').localeCompare(String(b.type || '')),
      filters: typeFilters, filterSearch: true, onFilter: (value, row) => row.type === value,
    },
    {
      title: 'Status', dataIndex: 'status', width: 130,
      render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
      filters: Object.keys(STATUS_COLORS).map(s => ({ text: s, value: s })),
      onFilter: (value, row) => row.status === value,
    },
    {
      // Newest raised first.
      title: 'Raised', dataIndex: 'created_at', width: 160, render: dt, defaultSortOrder: 'descend',
      sorter: (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')),
    },
    {
      title: 'Closed', dataIndex: 'closed_at', width: 160, render: dt,
      sorter: (a, b) => String(a.closed_at || '').localeCompare(String(b.closed_at || '')),
    },
    {
      title: 'Turnaround', dataIndex: 'tat_minutes', width: 120,
      sorter: (a, b) => compareNullable(a.tat_minutes, b.tat_minutes),
      render: (v, row) => (v === null ? <Text type="secondary">-</Text> : (
        <Tooltip title={row.exact ? undefined : 'Only dates are known for this SR, so the time is approximate'}>
          <b>{formatDuration(v)}</b>{!row.exact && <Text type="secondary"> ~</Text>}
        </Tooltip>
      )),
    },
    {
      title: 'Open for', dataIndex: 'age_minutes', width: 110,
      sorter: (a, b) => compareNullable(a.age_minutes, b.age_minutes),
      render: v => (v === null ? <Text type="secondary">-</Text> : formatDuration(v)),
    },
    {
      title: 'Expected closure', dataIndex: 'expected_closure_date', width: 150,
      sorter: (a, b) => String(a.expected_closure_date || '').localeCompare(String(b.expected_closure_date || '')),
      render: (v, row) => (v ? <span style={row.overdue ? { color: '#cf1322', fontWeight: 600 } : undefined}>{day(v)}{row.overdue ? ' (overdue)' : ''}</span> : <Text type="secondary">-</Text>),
    },
  ], [onOpen, showTechnician, technicianFilters, typeFilters]);

  return (
    <div>
      {searchable && (
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <TableSearch value={search} onChange={setSearch} placeholder="Search SR no, description, type, status..." width={300} />
          {search && <Text type="secondary" style={{ fontSize: 12 }}>{rows.length} of {records.length}</Text>}
        </div>
      )}
      <Table
        rowKey="id" size="small" bordered columns={columns} dataSource={rows} loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={paginationConfig('SRs', { defaultPageSize: pageSize })}
        locale={{ emptyText: 'No SRs match these filters' }}
      />
    </div>
  );
}
