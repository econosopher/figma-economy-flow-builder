import { hex } from '../utils';

describe('hex', () => {
  it('should convert valid hex colors to RGB', () => {
    expect(hex('#FFFFFF')).toEqual({ r: 1, g: 1, b: 1 });
    expect(hex('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hex('#FF0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(hex('#00FF00')).toEqual({ r: 0, g: 1, b: 0 });
    expect(hex('#0000FF')).toEqual({ r: 0, g: 0, b: 1 });
  });

  it('should return gray for invalid hex colors', () => {
    const gray = { r: 0.8, g: 0.8, b: 0.8 };
    expect(hex('#FFF')).toEqual(gray);
    expect(hex('red')).toEqual(gray);
    expect(hex('#GGGGGG')).toEqual(gray);
    expect(hex('')).toEqual(gray);
    expect(hex(null as any)).toEqual(gray);
  });

  it('should handle lowercase hex colors', () => {
    expect(hex('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(hex('#4caf50')).toEqual({ r: 0.2980392156862745, g: 0.6862745098039216, b: 0.3137254901960784 });
  });

  it('should log warnings for invalid colors', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    hex('#INVALID');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid color format: #INVALID')
    );
    
    consoleSpy.mockRestore();
  });
});