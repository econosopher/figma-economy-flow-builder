/// <reference types="@figma/plugin-typings" />

import { TAG } from './constants';

export const hex = (h: string) => {
  if (typeof h !== 'string' || !h.match(/^#[0-9A-Fa-f]{6}$/)) {
    console.warn(`Invalid color format: ${h}. Using default gray.`);
    return { r: 0.8, g: 0.8, b: 0.8 };
  }
  try {
    const n = parseInt(h.slice(1), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  } catch (error) {
    console.error('Error parsing color:', error);
    return { r: 0.8, g: 0.8, b: 0.8 };
  }
};

export async function loadFonts() {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  } catch (error) {
    console.error('Failed to load fonts:', error);
    throw new Error('Required fonts (Inter Regular/Medium) are not available. Please install them in Figma.');
  }
}

export function clear() {
  try {
    // First try to find and remove sections with our plugin data
    const sectionsToRemove = figma.currentPage.findAll(n =>
      n.type === 'SECTION' && n.getPluginData("economyFlowSection") === "true"
    );

    // Also find and remove legend sections
    const legendSections = figma.currentPage.findAll(n =>
      n.type === 'SECTION' && n.name === 'Legend'
    );

    // Find connectors with our plugin data
    const connectorsToRemove = figma.currentPage.findAll(n =>
      n.type === 'CONNECTOR' && n.getPluginData('economyFlowConnector') === 'true'
    );

    // Find sections that match our naming pattern (e.g., "Game Name Economy")
    const economySections = figma.currentPage.findAll(n =>
      n.type === 'SECTION' && n.name.endsWith(' Economy')
    );

    sectionsToRemove.forEach(section => {
      try {
        section.remove();
      } catch (error) {
        console.error('Failed to remove section:', error);
      }
    });

    legendSections.forEach(section => {
      try {
        section.remove();
      } catch (error) {
        console.error('Failed to remove legend section:', error);
      }
    });

    economySections.forEach(section => {
      try {
        section.remove();
      } catch (error) {
        console.error('Failed to remove economy section:', error);
      }
    });

    connectorsToRemove.forEach(connector => {
      try {
        connector.remove();
      } catch (error) {
        console.error('Failed to remove connector:', error);
      }
    });

    // Then remove any remaining nodes with our TAG (legacy support)
    const nodesToRemove = figma.currentPage.findAll(n => n.name.includes(TAG));
    console.log(`Clearing ${sectionsToRemove.length + economySections.length} sections, ${legendSections.length} legend sections, ${connectorsToRemove.length} connectors, and ${nodesToRemove.length} nodes`);

    nodesToRemove.forEach(n => {
      try {
        n.remove();
      } catch (error) {
        console.error('Failed to remove node:', error);
      }
    });
  } catch (error) {
    console.error('Clear operation failed:', error);
  }
}

export function reply(msg: string | string[], ok: boolean) {
  try {
    if (typeof figma !== 'undefined' && figma.ui) {
      figma.ui.postMessage({ type: 'reply', msg, ok });
    }
  } catch (error) {
    console.error('Failed to send message to UI:', error);
  }
}

export function isShapeWithText(node: SceneNode): node is ShapeWithTextNode {
  return 'text' in node;
}