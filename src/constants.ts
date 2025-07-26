/// <reference types="@figma/plugin-typings" />

export const COLOR = {
  // Specific color palette as requested
  INITIAL_SINK_NODE: '#DA5433',
  XP_ORANGE: '#EC9F53',
  FINAL_GOOD_YELLOW: '#F5C95C',
  SOURCE_GREEN: '#4CAF50',
  
  // Default/Neutral colors
  MAIN_WHITE: '#FFFFFF',
  HEADER_BLACK: '#000000',
  CONNECTOR_GREY: '#757575',
  STROKE_GREY: '#CCCCCC',
};

export const TAG = 'EconomyFlowChart';

// Define base dimensions for consistency
const BASE_BOX_WIDTH = 144;
const BASE_BOX_HEIGHT = 90;

export const BOX_SIZE = { 
  INPUT: { W: BASE_BOX_WIDTH, H: BASE_BOX_HEIGHT }, // Always same as NODE
  NODE: { W: BASE_BOX_WIDTH, H: BASE_BOX_HEIGHT },
  ATTR: { W: 112, H: 20 },
  FINAL_GOOD: { W: BASE_BOX_WIDTH, H: BASE_BOX_HEIGHT },
  FINAL_GOOD_HEADER: { H: 24 } // Black tether height
};

export const PADDING = { X: 100, Y: 21 }; // Further reduced Y padding by 30% for tighter layout
export const SECTION_PADDING = 100; // Increased from 50 for more margin
export const INITIAL_X_OFFSET = 40; // Offset from left edge to prevent nodes being flush with subsection
export const INITIAL_Y_OFFSET = 40; // Offset from top edge to prevent nodes being flush with subsection