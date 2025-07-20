/// <reference types="@figma/plugin-typings" />

import { COLOR, BOX_SIZE } from './constants';
import { hex } from './utils';

export function makeBox(txt: string, w: number, h: number, fill: string, align: 'CENTER' | 'LEFT' = 'CENTER'): SceneNode {
  try {
    // Validate inputs
    if (!txt || typeof txt !== 'string') {
      console.warn('Invalid text for box, using empty string');
      txt = '';
    }
    if (w <= 0 || h <= 0) {
      throw new Error(`Invalid dimensions: width=${w}, height=${h}`);
    }

    // White text on dark backgrounds (red, black), black text on light backgrounds
    const isDarkBG = fill === COLOR.SINK_RED || fill === COLOR.HEADER_BLACK;
    const textColor = isDarkBG ? hex(COLOR.MAIN_WHITE) : hex(COLOR.HEADER_BLACK);

    const s = figma.createShapeWithText();
    s.shapeType = 'SQUARE';
    s.resize(w, h);
    s.fills = [{ type: 'SOLID', color: hex(fill) }];
    if (fill === COLOR.MAIN_WHITE) {
        s.strokes = [{type: 'SOLID', color: hex(COLOR.STROKE_GREY)}];
        s.strokeWeight = 2;
    }
    s.text.characters = txt;

    let fontSize = 12;
    // Reduce font size for long labels to prevent overflow
    if (w > 120 && txt.length > 40) { // Main node
      fontSize = 10;
    } else if (w < 120 && txt.length > 20) { // Attribute node
        fontSize = 10;
    }
    s.text.fontSize = fontSize;
    s.text.fills = [{ type: 'SOLID', color: textColor }];

    // @ts-ignore
    s.text.textAlignHorizontal = align;
    if (align === 'LEFT') {
      // @ts-ignore
      s.text.paragraphIndent = 5;
    }
    return s;
  } catch (error) {
    console.error('Error creating box:', error);
    throw error;
  }
}

export function makeFinalGoodBox(txt: string, w: number, h: number, bodyFill: string): SceneNode {
  try {
    // Validate inputs
    if (!txt || typeof txt !== 'string') {
      console.warn('Invalid text for final good box');
      txt = 'Final Good';
    }
    if (h < 30) {
      throw new Error('Final good box height too small for header + body');
    }

    const headerHeight = BOX_SIZE.FINAL_GOOD_HEADER.H;
    const bodyHeight = h - headerHeight;

    const body = makeBox(txt, w, bodyHeight, bodyFill);
    body.y = headerHeight;
    
    const header = makeBox("Final Good", w, headerHeight, COLOR.HEADER_BLACK);
    header.y = 0;

    const finalGroup = figma.group([header, body], figma.currentPage);
    finalGroup.name = "Final Good: " + txt;
    return finalGroup;
  } catch (error) {
    console.error('Error creating final good box:', error);
    // Fallback to regular box
    return makeBox(txt, w, h, bodyFill);
  }
}

export function createConnector(A: SceneNode, B: SceneNode) {
  try {
    if (!A || !B || !A.id || !B.id) {
      throw new Error('Invalid nodes for connection');
    }

    const c = figma.createConnector();
    c.connectorLineType = 'ELBOWED';
    c.strokeWeight = 2;
    // Use default grey for connectors
    c.strokes = [{ type: 'SOLID', color: hex(COLOR.CONNECTOR_GREY) }];
    
    if (B.name.startsWith("Final Good")) {
      c.dashPattern = [10, 10];
    }

    // Force left-to-right connection points
    c.connectorStart = { endpointNodeId: A.id, magnet: 'RIGHT' } as any;
    c.connectorEnd = { endpointNodeId: B.id, magnet: 'LEFT' } as any;
    return c;
  } catch (error) {
    console.error('Error creating connector:', error);
    throw error;
  }
}