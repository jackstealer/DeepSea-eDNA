// Colour constants for the 3D scenes and their HTML legends. No three.js import here,
// so pages can use the legend colours without pulling three.js into their main bundle.

/** Nucleotide colours shared by the 3D helices and their legends */
export const BASE_COLORS: Record<string, string> = {
  A: '#34d399', // emerald
  C: '#38bdf8', // sky
  G: '#fbbf24', // amber
  T: '#f472b6', // pink
};
export const UNKNOWN_BASE_COLOR = '#64748b';
export const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };

/** One colour per predicted taxon (by classId), for the landing-page clusters and their legend */
export const TAXON_COLORS = ['#5EEAD4', '#67E8F9', '#93C5FD', '#A5B4FC', '#C4B5FD', '#F0ABFC', '#F9A8D4', '#FDE68A'];
