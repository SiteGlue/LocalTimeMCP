#!/usr/bin/env node

import LocalTimeMCPServer from './index.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const server = new LocalTimeMCPServer();

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function interactiveTest() {
  console.log('🎮 Interactive Local Time MCP Server Test');
  console.log('=========================================');
  console.log('Enter zip codes to test (or "quit" to exit)\n');
  
  while (true) {
    const zipCode = await askQuestion('Enter zip/postal code: ');
    
    if (zipCode.toLowerCase() === 'quit') {
      break;
    }
    
    if (!zipCode.trim()) {
      console.log('Please enter a valid zip code.\n');
      continue;
    }
    
    try {
      console.log(`\n🔍 Testing: ${zipCode}`);
      console.log('─'.repeat(30));
      
      // Get current time
      const timeResult = await server.getBusinessTime(zipCode.trim());
      const timeData = JSON.parse(timeResult.content[0].text);
      
      if (timeData.success) {
        console.log(`⏰ Local Time: ${timeData.localTime}`);
        console.log(`🌍 Timezone: ${timeData.timezone}`);
        console.log(`📅 Date: ${timeData.date}`);
        console.log(`🔄 DST Active: ${timeData.isDST ? 'Yes' : 'No'}`);
        
        // Check business hours
        const hoursResult = await server.checkBusinessHours(zipCode.trim(), 'dental');
        const hoursData = JSON.parse(hoursResult.content[0].text);
        
        if (hoursData.success) {
          console.log(`🏢 Status: ${hoursData.isLikelyOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
          console.log(`💭 Reasoning: ${hoursData.analysis.reasoning}`);
          console.log(`📊 Business Hours: ${hoursData.analysis.businessHours}`);
        }
      } else {
        console.log(`❌ Error: ${timeData.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '═'.repeat(50) + '\n');
  }
  
  console.log('👋 Goodbye!');
  rl.close();
}

interactiveTest().catch(console.error);