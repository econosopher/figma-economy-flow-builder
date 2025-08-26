#!/usr/bin/env node

/**
 * Test script for Research API integration
 */

const API_URL = 'http://localhost:5001';

async function testHealthCheck() {
  console.log('🔍 Testing health check...');
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();
  console.log('✅ Health check:', data.status);
  return response.ok;
}

async function testCacheGeneration() {
  console.log('\n🔍 Testing cache generation...');
  const response = await fetch(`${API_URL}/api/research/cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameName: 'Test Game',
      depth: 2
    })
  });
  const data = await response.json();
  console.log('✅ Cache generated:');
  console.log('  - Session ID:', data.session_id);
  console.log('  - Categories:', data.cache?.categories?.length || 0);
  console.log('  - Depth:', data.cache?.depth);
  return response.ok && data.success;
}

async function testValidation() {
  console.log('\n🔍 Testing JSON validation...');
  const testJson = {
    inputs: [
      { id: 'time', label: 'Time', kind: 'initial_sink_node' }
    ],
    nodes: [
      {
        id: 'test_node',
        label: 'Test Node',
        sources: [],
        sinks: [],
        values: []
      }
    ],
    edges: [
      ['time', 'test_node']
    ]
  };
  
  const response = await fetch(`${API_URL}/api/research/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: testJson })
  });
  const data = await response.json();
  console.log('✅ Validation result:', data.valid ? 'Valid' : 'Invalid');
  return response.ok;
}

async function testTemplates() {
  console.log('\n🔍 Testing template listing...');
  const response = await fetch(`${API_URL}/api/templates`);
  const data = await response.json();
  console.log('✅ Templates found:', data.templates?.length || 0);
  return response.ok;
}

async function runTests() {
  console.log('🚀 Starting API Integration Tests\n');
  console.log('API URL:', API_URL);
  console.log('=' .repeat(50));
  
  let allPassed = true;
  
  try {
    allPassed = await testHealthCheck() && allPassed;
    allPassed = await testCacheGeneration() && allPassed;
    allPassed = await testValidation() && allPassed;
    allPassed = await testTemplates() && allPassed;
    
    console.log('\n' + '=' .repeat(50));
    if (allPassed) {
      console.log('✅ All tests passed!');
    } else {
      console.log('❌ Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Make sure the API server is running on port 5001');
    process.exit(1);
  }
}

runTests();