---
description: how to setup kiosk mode on Raspberry Pi
---
# Raspberry Pi Kiosk Mode Setup

To run the Production Counter automatically in full-screen (kiosk) mode on your Raspberry Pi, follow these steps:

### 1. Install necessary tools
You'll need `unclutter` to hide the mouse cursor after a few seconds of inactivity.
```bash
sudo apt update
sudo apt install unclutter
```

### 2. Manual Test (Optional)
Run this command from the terminal (while in the Desktop environment) to test if it opens correctly:
```bash
chromium-browser --kiosk --incognito --disable-infobars http://localhost:3000
```

### 3. Setup Autostart
To make it open every time the Pi starts:

1. Create or edit the autostart file:
   ```bash
   mkdir -p ~/.config/lxsession/LXDE-pi/
   nano ~/.config/lxsession/LXDE-pi/autostart
   ```
2. Add the following lines to the file:
   ```text
   @lxpanel --profile LXDE-pi
   @pcmanfm --desktop --profile LXDE-pi
   @unclutter -idle 0.1 -root
   @chromium-browser --kiosk --incognito --disable-infobars http://localhost:3000
   ```
3. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 4. Extra Tips
- **Exit Kiosk Mode**: Press `Alt + F4` or `Ctrl + W` to close the browser.
- **Refresh Page**: Press `Ctrl + R` if you need to manually refresh.
- **Rotate Screen**: If your monitor is vertical, use the Raspberry Pi Configuration tool (Preferences -> Screen Configuration) to rotate the layout.

> [!TIP]
> Make sure your central server is also set to start automatically (e.g., using `pm2` or a `systemd` service) so the page has data to show when it boots.
