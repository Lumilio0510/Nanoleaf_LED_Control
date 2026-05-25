const electron = require('electron');
console.log('electron type:', typeof electron);
if (typeof electron === 'string') {
  console.log('BUG: electron is string:', electron);
  process.exit(1);
} else {
  console.log('OK: electron.app:', typeof electron.app);
  electron.app.whenReady().then(() => {
    console.log('app ready!');
    electron.app.quit();
  });
}
