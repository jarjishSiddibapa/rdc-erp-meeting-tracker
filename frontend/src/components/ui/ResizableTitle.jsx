import { Resizable } from 'react-resizable';

// Drag-to-resize column headers for antd Table - the standard pattern of pairing
// react-resizable with a custom header `cell` renderer, since antd Table has no
// built-in column resizing.
export default function ResizableTitle(props) {
  const { onResize, width, ...restProps } = props;

  if (!width) return <th {...restProps} />;

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="col-resize-handle"
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
}
