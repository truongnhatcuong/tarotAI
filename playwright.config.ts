import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e', fullyParallel:false, retries:0,
  use:{baseURL:'http://127.0.0.1:3000',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:90000},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
});
