#!/usr/bin/env node
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

async function runLighthouse() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['accessibility', 'best-practices', 'seo'],
    port: chrome.port
  };

  // Run lighthouse against localhost (assumes dev server is running)
  const runnerResult = await lighthouse('http://localhost:3000', options);

  // Output results
  const reportHtml = runnerResult.report;
  const score = runnerResult.lhr.categories.accessibility.score * 100;
  
  console.log('\n🔍 Lighthouse Accessibility Audit Results:');
  console.log(`📊 Accessibility Score: ${score}/100`);
  
  if (score >= 90) {
    console.log('✅ Excellent accessibility score!');
  } else if (score >= 70) {
    console.log('⚠️  Good accessibility score, but room for improvement');
  } else {
    console.log('❌ Accessibility needs attention');
  }

  // Save detailed report
  const reportsDir = path.join(__dirname, '..', 'lighthouse-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const reportPath = path.join(reportsDir, `accessibility-report-${timestamp}.html`);
  fs.writeFileSync(reportPath, reportHtml);
  
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  
  // Check specific accessibility metrics
  const audits = runnerResult.lhr.audits;
  const importantAudits = [
    'color-contrast',
    'image-alt',
    'button-name',
    'link-name',
    'form-field-multiple-labels',
    'heading-order',
    'aria-allowed-attr',
    'aria-required-attr'
  ];
  
  console.log('\n🔍 Key Accessibility Checks:');
  importantAudits.forEach(auditId => {
    if (audits[auditId]) {
      const audit = audits[auditId];
      const status = audit.score === 1 ? '✅' : audit.score === null ? '⚠️' : '❌';
      console.log(`${status} ${audit.title}: ${audit.score === 1 ? 'PASS' : 'NEEDS ATTENTION'}`);
    }
  });

  await chrome.kill();
  return score;
}

if (require.main === module) {
  runLighthouse()
    .then(score => {
      process.exit(score >= 70 ? 0 : 1);
    })
    .catch(err => {
      console.error('❌ Lighthouse audit failed:', err);
      process.exit(1);
    });
}

module.exports = runLighthouse;
