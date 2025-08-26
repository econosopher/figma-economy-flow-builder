// Mock Figma API for testing

export class MockSceneNode {
  id: string;
  name: string = '';
  type: string = 'FRAME';
  x: number = 0;
  y: number = 0;
  width: number = 100;
  height: number = 100;
  visible: boolean = true;
  locked: boolean = false;
  parent: MockSceneNode | null = null;
  private pluginData: { [key: string]: string } = {};
  
  constructor(type: string = 'FRAME') {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = type;
  }
  
  setPluginData(key: string, value: string) {
    this.pluginData[key] = value;
  }
  
  getPluginData(key: string): string {
    return this.pluginData[key] || '';
  }
  
  remove() {
    // Mock remove
  }
}

export class MockGroupNode extends MockSceneNode {
  children: MockSceneNode[] = [];
  
  constructor() {
    super('GROUP');
  }
  
  appendChild(child: MockSceneNode) {
    // If child already exists, move it to the end (Figma semantics)
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
    }
    this.children.push(child);
    child.parent = this;
  }
  
  findOne(callback: (node: MockSceneNode) => boolean): MockSceneNode | null {
    for (const child of this.children) {
      if (callback(child)) return child;
      if ('children' in child) {
        const found = (child as MockGroupNode).findOne(callback);
        if (found) return found;
      }
    }
    return null;
  }
}

export class MockSectionNode extends MockGroupNode {
  fills: any[] = [];
  
  constructor() {
    super();
    this.type = 'SECTION';
  }
  
  resizeWithoutConstraints(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export class MockShapeWithTextNode extends MockSceneNode {
  text = {
    characters: '',
    fontSize: 12,
    fills: [] as any[],
    textAlignHorizontal: 'CENTER' as const,
    paragraphIndent: 0
  };
  shapeType: string = 'SQUARE';
  fills: any[] = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  strokes: any[] = [];
  strokeWeight: number = 0;
  
  constructor() {
    super('SHAPE_WITH_TEXT');
  }
  
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export class MockConnectorNode extends MockSceneNode {
  connectorStart: any = {};
  connectorEnd: any = {};
  connectorLineType: string = 'ELBOWED';
  strokeWeight: number = 2;
  strokes: any[] = [];
  dashPattern: number[] = [];
  
  constructor() {
    super('CONNECTOR');
  }
}

export class MockPageNode extends MockGroupNode {
  constructor() {
    super();
    this.type = 'PAGE';
  }
  
  findAll(callback: (node: MockSceneNode) => boolean): MockSceneNode[] {
    const results: MockSceneNode[] = [];
    const traverse = (node: MockSceneNode) => {
      if (callback(node)) results.push(node);
      if ('children' in node) {
        (node as MockGroupNode).children.forEach(traverse);
      }
    };
    this.children.forEach(traverse);
    return results;
  }
}

// Mock the global figma object
export const mockFigma = {
  currentPage: new MockPageNode(),
  
  createSection(): MockSectionNode {
    return new MockSectionNode();
  },
  
  createShapeWithText(): MockShapeWithTextNode {
    return new MockShapeWithTextNode();
  },
  
  createConnector(): MockConnectorNode {
    return new MockConnectorNode();
  },
  
  group(nodes: MockSceneNode[], parent: any): MockGroupNode {
    const group = new MockGroupNode();
    nodes.forEach(node => group.appendChild(node));
    return group;
  },
  
  loadFontAsync: jest.fn().mockResolvedValue(undefined),
  
  viewport: {
    scrollAndZoomIntoView: jest.fn()
  },
  
  ui: {
    postMessage: jest.fn()
  }
};

// Helper to check if node is ShapeWithText
export function isShapeWithText(node: any): node is MockShapeWithTextNode {
  return 'text' in node;
}

// Add a simple test to prevent Jest from complaining
describe('Figma Mocks', () => {
  it('should export mock objects', () => {
    expect(mockFigma).toBeDefined();
    expect(MockSceneNode).toBeDefined();
    expect(MockGroupNode).toBeDefined();
    expect(MockSectionNode).toBeDefined();
  });
});
