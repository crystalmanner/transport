// CSS can't read JS values inside @media rules, so these numbers are repeated
// in the stylesheets. Change both together.
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
};

// .98 keeps fractional widths (zoomed or high-DPI screens) on the mobile side of the tablet breakpoint.
export const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.tablet - 0.02}px)`;
