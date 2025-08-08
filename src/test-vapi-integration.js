#!/usr/bin/env node

/**
 * Test Vapi MCP Integration
 * Simulates how Vapi would connect to and use the MCP server
 */

import fetch from 'node-fetch';

const SERVER_URL = process.env.TEST_URL || 'http://localhost:3000';

class VapiMCPTester {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 Testing Vapi MCP Integration');
    console.log(`📍 Server URL: ${this.serverUrl}`);
    console.log('='.repeat(50));

    // Test 1: Health check
    await this.testHealthCheck();
    
    // Test 2: SSE endpoint availability
    await this.testSSEEndpoint();
    
    // Test 3: MCP HTTP Protocol
    await this.testMCPHttpProtocol();
    
    // Test 4: Tool functionality
    await this.testToolFunctionality();
    
    // Test 5: Vapi-specific scenarios
    await this.testVapiScenarios();

    this.printSummary();
  }

  async testHealthCheck() {
    console.log('\n1. 🏥 Health Check Test');
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      const data = await response.json();
      
      this.assert(response.ok, 'Health endpoint should return 200');
      this.assert(data.status === 'healthy', 'Should report healthy status');
      this.assert(data.protocols.includes('SSE'), 'Should support SSE protocol');
      
      console.log('   ✅ Server is healthy and ready');
    } catch (error) {
      console.log('   ❌ Health check failed:', error.message);
    }
  }

  async testSSEEndpoint() {
    console.log('\n2. 🔌 SSE Endpoint Test');
    try {
      // Test that SSE endpoint exists and returns proper headers
      const response = await fetch(`${this.serverUrl}/mcp`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      this.assert(response.ok, 'SSE endpoint should be accessible');
      this.assert(
        response.headers.get('content-type') === 'text/event-stream', 
        'Should return text/event-stream content type'
      );
      
      console.log('   ✅ SSE endpoint is properly configured');
    } catch (error) {
      console.log('   ❌ SSE endpoint test failed:', error.message);
    }
  }

  async testMCPHttpProtocol() {
    console.log('\n3. 📨 MCP HTTP Protocol Test');
    
    // Test initialize
    await this.testMCPInitialize();
    
    // Test tools/list
    await this.testMCPToolsList();
  }

  async testMCPInitialize() {
    try {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'Vapi Test Client', version: '1.0.0' }
        }
      };

      const response = await fetch(`${this.serverUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initRequest)
      });

      const data = await response.json();
      
      this.assert(response.ok, 'Initialize request should succeed');
      this.assert(data.jsonrpc === '2.0', 'Should return JSON-RPC 2.0 format');
      this.assert(data.result, 'Should return initialization result');
      this.assert(data.result.serverInfo.name.includes('Local Time'), 'Should identify as Local Time server');
      
      console.log('   ✅ MCP Initialize protocol working');
    } catch (error) {
      console.log('   ❌ MCP Initialize failed:', error.message);
    }
  }

  async testMCPToolsList() {
    try {
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await fetch(`${this.serverUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolsRequest)
      });

      const data = await response.json();
      
      this.assert(response.ok, 'Tools list request should succeed');
      this.assert(data.result.tools, 'Should return tools array');
      this.assert(data.result.tools.length === 3, 'Should have 3 tools');
      
      const toolNames = data.result.tools.map(tool => tool.name);
      this.assert(toolNames.includes('getBusinessTime'), 'Should include getBusinessTime tool');
      this.assert(toolNames.includes('checkBusinessHours'), 'Should include checkBusinessHours tool');
      
      console.log('   ✅ MCP Tools listing working');
      console.log(`   📋 Available tools: ${toolNames.join(', ')}`);
    } catch (error) {
      console.log('   ❌ MCP Tools list failed:', error.message);
    }
  }

  async testToolFunctionality() {
    console.log('\n4. 🛠️ Tool Functionality Test');
    
    // Test getBusinessTime tool
    await this.testGetBusinessTimeTool();
    
    // Test checkBusinessHours tool
    await this.testCheckBusinessHoursTool();
  }

  async testGetBusinessTimeTool() {
    try {
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'getBusinessTime',
          arguments: {
            zipCode: '33067', // Parkland, FL
            format: '12-hour'
          }
        }
      };

      const response = await fetch(`${this.serverUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCallRequest)
      });

      const data = await response.json();
      const toolResult = JSON.parse(data.result.content[0].text);
      
      this.assert(response.ok, 'getBusinessTime tool call should succeed');
      this.assert(toolResult.success, 'Tool should return success');
      this.assert(toolResult.localTime, 'Should return local time');
      this.assert(toolResult.timezone === 'America/New_York', 'Florida should be Eastern Time');
      
      console.log('   ✅ getBusinessTime tool working');
      console.log(`   ⏰ Current time in Parkland, FL: ${toolResult.localTime}`);
    } catch (error) {
      console.log('   ❌ getBusinessTime tool failed:', error.message);
    }
  }

  async testCheckBusinessHoursTool() {
    try {
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'checkBusinessHours',
          arguments: {
            zipCode: '33067',
            businessType: 'dental'
          }
        }
      };

      const response = await fetch(`${this.serverUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCallRequest)
      });

      const data = await response.json();
      const toolResult = JSON.parse(data.result.content[0].text);
      
      this.assert(response.ok, 'checkBusinessHours tool call should succeed');
      this.assert(toolResult.success, 'Tool should return success');
      this.assert(typeof toolResult.isLikelyOpen === 'boolean', 'Should return open/closed status');
      this.assert(toolResult.analysis.reasoning, 'Should provide reasoning');
      
      console.log('   ✅ checkBusinessHours tool working');
      console.log(`   🏢 Dental practice status: ${toolResult.isLikelyOpen ? 'OPEN' : 'CLOSED'}`);
      console.log(`   💭 Reasoning: ${toolResult.analysis.reasoning}`);
    } catch (error) {
      console.log('   ❌ checkBusinessHours tool failed:', error.message);
    }
  }

  async testVapiScenarios() {
    console.log('\n5. 🎤 Vapi-Specific Scenarios Test');
    
    // Simulate common voice agent scenarios
    await this.testVoiceAgentScenarios();
  }

  async testVoiceAgentScenarios() {
    console.log('\n   📱 Simulating voice agent interactions...');
    
    // Scenario 1: "Are you open right now?"
    try {
      const hoursCheck = await this.callTool('checkBusinessHours', {
        zipCode: '33067',
        businessType: 'dental'
      });
      
      const timeCheck = await this.callTool('getBusinessTime', {
        zipCode: '33067',
        format: '12-hour'
      });
      
      // Simulate voice response generation
      const voiceResponse = this.generateVoiceResponse(hoursCheck, timeCheck);
      
      console.log('   🎯 Scenario: "Are you open right now?"');
      console.log(`   🗣️ Voice agent would say: "${voiceResponse}"`);
      
      this.assert(voiceResponse.length > 0, 'Should generate voice response');
      
    } catch (error) {
      console.log('   ❌ Voice scenario test failed:', error.message);
    }
  }

  async callTool(toolName, args) {
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    };

    const response = await fetch(`${this.serverUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolCallRequest)
    });

    const data = await response.json();
    return JSON.parse(data.result.content[0].text);
  }

  generateVoiceResponse(hoursData, timeData) {
    if (hoursData.isLikelyOpen) {
      return `Yes, we're currently open! It's ${timeData.localTime} and we're here to help with your dental needs.`;
    } else {
      const reasoning = hoursData.analysis.reasoning.toLowerCase();
      if (reasoning.includes('weekend') || reasoning.includes('sunday') || reasoning.includes('saturday')) {
        return `We're closed for the weekend. It's ${timeData.localTime}. We'll be open again Monday at 8 AM. For emergencies, please call our emergency line.`;
      } else if (reasoning.includes('before')) {
        return `We're not open yet. It's currently ${timeData.localTime} and we open at 8 AM. You can leave a voicemail and we'll call you back.`;
      } else {
        return `We're closed for today. It's ${timeData.localTime} and we close at 5 PM. We'll be open again tomorrow at 8 AM.`;
      }
    }
  }

  assert(condition, message) {
    this.testResults.push({ condition, message });
    if (condition) {
      // console.log(`   ✅ ${message}`);
    } else {
      console.log(`   ❌ ${message}`);
    }
  }

  printSummary() {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(result => result.condition).length;
    const total = this.testResults.length;
    const failed = total - passed;
    
    console.log(`✅ Passed: ${passed}/${total}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}/${total}`);
    }
    
    const successRate = ((passed / total) * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Your MCP server is ready for Vapi integration!');
      console.log('\n📋 Next Steps:');
      console.log('1. Deploy to Heroku: git push heroku main');
      console.log('2. Add MCP tool to your Vapi assistant');
      console.log('3. Test with actual voice calls');
    } else {
      console.log('\n⚠️ Some tests failed. Please fix issues before deploying to Vapi.');
      
      console.log('\nFailed Tests:');
      this.testResults
        .filter(result => !result.condition)
        .forEach(result => console.log(`   - ${result.message}`));
    }
  }
}

// Run tests
async function main() {
  const serverUrl = process.argv[2] || SERVER_URL;
  const tester = new VapiMCPTester(serverUrl);
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default VapiMCPTester;