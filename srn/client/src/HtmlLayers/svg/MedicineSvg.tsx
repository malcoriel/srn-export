import * as React from 'react';

export const SvgComponent = ({
  fill,
  stroke,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={128}
    height={128}
    viewBox="0 0 128 128"
    {...props}
  >
    <path
      d="M53.27 38.227l37.617 13.691a10 10 0 015.977 12.817l-18.352 50.421a10 10 0 01-12.817 5.977l-37.617-13.691A10 10 0 0122.1 94.625l18.352-50.422a10 10 0 0112.817-5.976zm5.927 28.76l-2.525 6.937-6.94-2.525-2.956 8.123 6.94 2.526-2.465 6.77 8.632 3.142 2.464-6.77 7.106 2.586 2.957-8.123-7.106-2.587 2.525-6.938zm.474-52.562l-6.344 17.432 41.97 15.276 6.345-17.432z"
      fill={fill}
      stroke={stroke}
      strokeWidth={1.077}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default SvgComponent;
