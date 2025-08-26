#!/usr/bin/env python3
"""
Setup script to configure default API key for development
This reads your API key from the secure config and sets it as default
"""

import sys
import os
from pathlib import Path

# Add the deep_research_economy to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'deep_research_economy'))

try:
    from providers.secure_config import SecureConfig
    
    # Get the API key from secure config
    config = SecureConfig()
    api_key = config.get_api_key('gemini')
    
    if not api_key:
        print("No Gemini API key found in secure config")
        print("Run this in deep_research_economy first:")
        print("  python3 economy_json_builder.py setup")
        sys.exit(1)
    
    # Update the default-config.ts file
    config_file = Path(__file__).parent / 'src' / 'default-config.ts'
    
    config_content = f"""/**
 * Default configuration for development
 * THIS FILE SHOULD NOT BE COMMITTED TO GIT
 * Add to .gitignore: src/default-config.ts
 */

// For production/distribution, this should be empty
// For your personal development, your API key is included
export const DEFAULT_CONFIG = {{
  apiKey: '{api_key}',
  validated: true
}};"""
    
    config_file.write_text(config_content)
    
    print(f"✅ Default API key configured successfully!")
    print(f"   Key: {api_key[:10]}...{api_key[-4:]}")
    print("\n⚠️  Important: This file should not be committed to git")
    print("   Add to .gitignore: src/default-config.ts")
    
except ImportError as e:
    print(f"Error: Could not import secure_config: {e}")
    print("Make sure you have the deep_research_economy project set up")
    sys.exit(1)
except Exception as e:
    print(f"Error setting up default key: {e}")
    sys.exit(1)