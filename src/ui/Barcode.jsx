import { code39 } from './code39.js';

/** The barcode as an SVG stretched to its box. */
export function Barcode({ value = '', className = '' }) {
  const { bars, width, text } = code39(value);
  return (
    <svg className={className} viewBox={`0 0 ${width} 10`} preserveAspectRatio="none" role="img" aria-label={'Barcode: ' + text} data-ui="barcode" data-value={text}>
      {bars.map(([x, w]) => <rect key={x} x={x} y="0" width={w} height="10" />)}
    </svg>
  );
}
