/// <reference types="@figma/plugin-typings" />

export const COLOR = {
  // Specific color palette as requested
  SINK_RED: '#DA5433',
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

export const BOX_SIZE = { 
  INPUT: { W: 144, H: 72 },
  NODE: { W: 144, H: 90 }, // Increased by 25% from 72
  ATTR: { W: 112, H: 20 },
  FINAL_GOOD: { W: 144, H: 90 }, // Same as NODE height
  FINAL_GOOD_HEADER: { H: 24 } // Black tether height
};

export const PADDING = { X: 100, Y: 40 };
export const SECTION_PADDING = 100; // Increased from 50 for more margin