import * as React from 'react';

export const WeaponSvg = ({
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
      d="M68.114 10.076L62.73 19.4l7.513 4.338-7.394 12.806 20.76 11.986 7.394-12.806 7.989 4.612 6.604 24.773 8.799-2.369-8.175-30.665zm-7.822 32.153a227.98 227.98 0 00-7.368 9.679l7.992 4.614 6.033-10.45zm12.273 7.086l-6.033 10.45 8.636 4.986a236.245 236.245 0 004.708-11.216zM54.58 39.493a30.658 42.635 30 00-12.813 5.974l5.86 3.382c2.219-3.136 4.544-6.25 6.953-9.356zm30.465 17.983a250.49 250.49 0 01-4.5 10.38l5.601 3.233a30.658 42.635 30 00-1.101-13.613zm-48.697-7.65a30.658 42.635 30 00-8.851 10.487l9.25 5.34a235.985 235.985 0 017.194-11.444zm12.86 7.424a214.113 214.113 0 00-7.2 11.44l8.912 5.146 6.754-11.698zm14.082 8.13l-6.754 11.698 9.577 5.53a215.998 215.998 0 006.29-11.966zm14.443 8.339a231.293 231.293 0 01-6.353 11.93l9.048 5.223a30.658 42.635 30 004.656-12.909zM24.24 65.917a30.658 42.635 30 00-5.095 14.528l7.513 4.337a232.704 232.704 0 016.876-13.5zm14.573 8.414a219.065 219.065 0 00-6.79 13.55l8.093 4.67 7.564-13.101zm14.483 8.361L45.73 95.794l8.765 5.06a216.256 216.256 0 008.34-12.654zm14.795 8.542a239.981 239.981 0 01-8.304 12.675l7.383 4.263a30.658 42.635 30 0010.034-11.676zM18.26 87.42a30.658 42.635 30 001.545 13.41c1.33-3.43 2.716-6.8 4.164-10.114zm11.127 6.424a254.536 254.536 0 00-4.313 10.818l6.037 3.485 5.762-9.981zm13.102 7.564l-5.763 9.981 6.695 3.866a243.872 243.872 0 007.23-9.135zm13.496 7.792a278.75 278.75 0 01-6.567 8.538 30.658 42.635 30 0012.15-5.314z"
      fill={fill}
      stroke={stroke}
      strokeWidth={0.884}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);