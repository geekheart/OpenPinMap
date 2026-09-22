import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests/browser',fullyParallel:false,workers:1,timeout:45000,retries:process.env.CI?1:0,
 reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
 use:{baseURL:'http://127.0.0.1:8766/OpenPinMap/',browserName:'chromium',viewport:{width:1440,height:1000},acceptDownloads:true,trace:'retain-on-failure'},
 webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:8766/OpenPinMap/',reuseExistingServer:!process.env.CI}
});
