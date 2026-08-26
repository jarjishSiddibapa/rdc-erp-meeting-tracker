import { useState, useEffect, useRef } from 'react';
import { Popover, Timeline, Spin, Typography, Avatar } from 'antd';
import { CommentOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { srAPI } from '../services/api';

const { Text } = Typography;
function fmtDT(d) { return d ? dayjs(d).format('DD-MMM-YYYY hh:mm A') : '-'; }

// Same click-to-see-full-history pattern as ClosureDateCell, for comments: the cell itself
// only ever shows the latest comment, click it to see every comment ever left on this SR.
// History is fetched on first click and cached until `lastCommentAt` changes (i.e. a new
// comment landed), same invalidation trick ClosureDateCell uses for its own `value` prop.
export default function CommentCell({ srId, lastComment, lastCommentAt }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState(null); // null = not fetched yet
  const prevValue = useRef(lastCommentAt);

  useEffect(() => {
    if (prevValue.current !== lastCommentAt) {
      prevValue.current = lastCommentAt;
      setComments(null);
    }
  }, [lastCommentAt]);

  async function handleOpenChange(next) {
    setOpen(next);
    if (next && comments === null) {
      setLoading(true);
      try {
        const res = await srAPI.get(srId);
        setComments(res.data.comments || []);
      } catch {
        setComments([]);
      } finally {
        setLoading(false);
      }
    }
  }

  if (!lastComment) return <Text type="secondary">-</Text>;

  const content = (
    <div style={{ maxWidth: 320, minWidth: 240, maxHeight: 320, overflowY: 'auto' }}>
      {loading ? (
        <Spin size="small" />
      ) : !comments || comments.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>No comments yet.</Text>
      ) : (
        <Timeline
          items={comments.map((c, i) => ({
            dot: <Avatar size={16} icon={<UserOutlined style={{ fontSize: 10 }} />} style={{ background: i === 0 ? '#00B51A' : '#bfbfbf' }} />,
            children: (
              <div style={{ fontSize: 12 }}>
                <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.comment}</Text><br />
                <Text type="secondary">{c.commenter_name || 'Unknown'} · {fmtDT(c.commented_at)}</Text>
              </div>
            ),
          }))}
        />
      )}
    </div>
  );

  return (
    <Popover
      title={<Text strong><CommentOutlined /> Comment History</Text>}
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <div style={{ cursor: 'pointer' }}>
        <Text style={{
          borderBottom: '1px dotted currentColor',
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {lastComment}
        </Text>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtDT(lastCommentAt)}</div>
      </div>
    </Popover>
  );
}
