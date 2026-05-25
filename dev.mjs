import { spawn } from 'child_process'
delete process.env.ELECTRON_RUN_AS_NODE
spawn('npx electron-vite dev', { stdio: 'inherit', shell: true })
